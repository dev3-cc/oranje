import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { StorageService } from '../../../infra/storage/index.js'

import { DocumentRow, DocumentsRepository } from './documents.repository.js'
import type { CreateDocumentDto } from './dto/document.dto.js'

const TAX_DOCUMENT = 'SSN_ITIN'

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
