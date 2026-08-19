import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { DocumentRow, DocumentsRepository } from './documents.repository.js'
import type { CreateDocumentDto } from './dto/document.dto.js'

const TAX_DOCUMENT = 'SSN_ITIN'

export interface DocumentEntity {
  id: string
  documentType: string
  filePath: string
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
  constructor(private readonly repo: DocumentsRepository) {}

  async list(workerId: string): Promise<DocumentList> {
    await this.worker(workerId)

    const hasTaxId = await this.repo.hasTaxId(workerId)

    return {
      data: (await this.repo.listAll(workerId)).map(toEntity),
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

    return toEntity(
      await this.repo.create({
        workerId,
        documentType: dto.documentType,
        filePath: dto.filePath,
        userId: user.id,
        roleCode: user.roleCode,
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

    return toEntity(
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
}

function toEntity(row: DocumentRow): DocumentEntity {
  return {
    id: row.id,
    documentType: row.documentType,
    filePath: row.filePath,
    isVerified: row.verifiedAt !== null,
    verifiedBy: row.verifierUser,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

export { TAX_DOCUMENT }
