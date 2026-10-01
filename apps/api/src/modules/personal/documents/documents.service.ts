import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { StorageService } from '../../../infra/storage/index.js'
import { NotificationPublisherService } from '../../notifications/index.js'
import { AccessDeadlineService } from '../me/access-deadline.service.js'

import { DocumentRow, DocumentsRepository } from './documents.repository.js'
import type { CreateDocumentDto } from './dto/document.dto.js'

const TAX_DOCUMENT = 'SSN_ITIN'

// Mismo nombre que ve la Reclutadora en el expediente (WorkerDetailPage.tsx,
// DOCUMENT_TYPE_LABEL) — el colaborador debe reconocer de cuál documento se trata.
const DOCUMENT_TYPE_NAME: Record<string, string> = {
  SSN_ITIN: 'SSN / ITIN',
  ID: 'Identificación oficial',
  PROOF_OF_ADDRESS: 'Comprobante de domicilio',
  OTHER: 'documento',
}

export interface DocumentEntity {
  id: string
  documentType: string
  filePath: string
  /// URL firmada para abrirlo. Caduca en una hora, y es null si no se pudo firmar.
  url: string | null
  isVerified: boolean
  verifiedBy: { id: string; fullName: string } | null
  verifiedAt: string | null
  createdAt: string
}

export interface DocumentList {
  data: DocumentEntity[]
  meta: { hasTaxId: boolean; taxRetentionApplies: boolean }
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly repo: DocumentsRepository,
    private readonly storage: StorageService,
    private readonly accessDeadline: AccessDeadlineService,
    private readonly notifications: NotificationPublisherService,
  ) {}

  async list(workerId: string): Promise<DocumentList> {
    await this.worker(workerId)

    const hasTaxId = await this.repo.hasTaxId(workerId)

    return {
      data: await Promise.all((await this.repo.listAll(workerId)).map((row) => this.toEntity(row))),
      meta: { hasTaxId, taxRetentionApplies: !hasTaxId },
    }
  }

  async create(
    workerId: string,
    dto: CreateDocumentDto,
    user: AuthenticatedUser,
  ): Promise<DocumentEntity> {
    await this.worker(workerId)

    if (dto.documentType !== 'OTHER' && (await this.repo.ofType(workerId, dto.documentType))) {
      throw new ConflictException({
        code: 'DOCUMENT_ALREADY_EXISTS',
        message: `Ya hay un documento de tipo ${dto.documentType}: bórralo antes de subir otro`,
      })
    }

    return this.toEntity(
      await this.repo.create({
        workerId,
        documentType: dto.documentType,
        filePath: dto.filePath,
        userId: user.id,
        roleCode: user.roleCode,
      }),
    )
  }

  // El alta que hace el propio colaborador. A diferencia de la de la
  // Reclutadora, un SSN_ITIN sin verificar NO choca: lo reemplaza, porque la
  // persona se puede equivocar de archivo y no tiene forma de borrarlo.
  async createOwn(
    workerId: string,
    filePath: string,
    user: AuthenticatedUser,
  ): Promise<DocumentEntity> {
    const current = await this.repo.unverifiedOfType(workerId, TAX_DOCUMENT)

    if (current?.verifiedAt != null) {
      throw new ConflictException({
        code: 'DOCUMENT_VERIFIED',
        message: 'Tu documento ya fue verificado: pide el cambio a Oranje',
      })
    }

    return this.toEntity(
      await this.repo.create({
        workerId,
        documentType: TAX_DOCUMENT,
        filePath,
        userId: user.id,
        roleCode: user.roleCode,
        origin: 'SELF',
        ...(current ? { replaceId: current.id } : {}),
      }),
    )
  }

  async verify(workerId: string, id: string, user: AuthenticatedUser): Promise<DocumentEntity> {
    await this.worker(workerId)

    const row = await this.document(workerId, id)

    if (row.verifiedAt !== null) {
      throw new ConflictException({
        code: 'DOCUMENT_ALREADY_VERIFIED',
        message: 'Este documento ya está verificado',
      })
    }

    return this.toEntity(
      await this.repo.verify({ id, workerId, userId: user.id, roleCode: user.roleCode }),
    )
  }

  async remove(workerId: string, id: string, user: AuthenticatedUser): Promise<void> {
    await this.worker(workerId)

    const row = await this.document(workerId, id)

    if (row.verifiedAt !== null) {
      throw new ConflictException({
        code: 'DOCUMENT_VERIFIED',
        message: 'Un documento verificado no se borra: deja rastro de quién lo revisó',
      })
    }

    await this.repo.remove({ id, workerId, userId: user.id, roleCode: user.roleCode })
  }

  /**
   * Rechazar (2026-09-30): el documento no sirve (ilegible, incorrecto…), se
   * invalida con motivo y se le vuelve a pedir al colaborador. Si el día de
   * gracia del expediente a medias ya pasó, el acceso se suspende de
   * inmediato — no hay un nuevo día de gracia, ya tuvo el suyo — porque
   * `is_profile_complete` (y con él `ownPartMissing`) vuelve a contar el
   * SSN/ITIN como faltante en cuanto la fila desaparece.
   *
   * Sin avisarle, el colaborador solo ve que el documento "desapareció" y
   * la app se lo vuelve a pedir sin explicar por qué (Hugo, 2026-09-30):
   * el aviso dice CUÁL documento y el motivo, para que no piense que su
   * carga se perdió.
   */
  async reject(
    workerId: string,
    id: string,
    reason: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const worker = await this.worker(workerId)

    const row = await this.document(workerId, id)

    if (row.verifiedAt !== null) {
      throw new ConflictException({
        code: 'DOCUMENT_VERIFIED',
        message: 'Un documento verificado no se rechaza: deja rastro de quién lo revisó',
      })
    }

    await this.repo.reject({ id, workerId, reason, userId: user.id, roleCode: user.roleCode })

    const ownerId = await this.repo.workerUserId(workerId)
    if (ownerId) this.accessDeadline.invalidate(ownerId)

    const documentName = DOCUMENT_TYPE_NAME[row.documentType] ?? row.documentType
    try {
      await this.notifications.publish({
        type: 'DOCUMENT_REJECTED',
        title: 'Documento rechazado',
        body: `Tu ${documentName} no pasó la revisión: ${reason}. Súbelo de nuevo desde Mis datos.`,
        entity: { type: 'personal.worker_document', id },
        actorUserId: user.id,
        audience: [{ kind: 'WORKER', workerId: worker.id }],
      })
    } catch {
      // Mejor esfuerzo: que Pub/Sub no responda no revierte el rechazo, que ya quedó escrito.
    }
  }

  private async document(workerId: string, id: string): Promise<DocumentRow> {
    const row = await this.repo.byId(workerId, id)

    if (!row) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'El documento no existe en el expediente de este colaborador',
      })
    }

    return row
  }

  private async worker(id: string): Promise<{ id: string; fullName: string }> {
    const row = await this.repo.workerExists(id)

    if (!row) {
      throw new NotFoundException({
        code: 'WORKER_NOT_FOUND',
        message: 'El colaborador no existe',
      })
    }

    return row
  }

  private async toEntity(row: DocumentRow): Promise<DocumentEntity> {
    return {
      id: row.id,
      documentType: row.documentType,
      filePath: row.filePath,
      url: await this.storage.signedUrl(row.filePath),
      isVerified: row.verifiedAt !== null,
      verifiedBy: row.verifierUser,
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }
  }
}

export { TAX_DOCUMENT }
