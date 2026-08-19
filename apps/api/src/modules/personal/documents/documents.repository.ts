import { Injectable } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

export interface DocumentRow {
  id: string
  documentType: string
  filePath: string
  verifiedAt: Date | null
  createdAt: Date
  verifierUser: { id: string; fullName: string } | null
}

const SELECT = {
  id: true,
  documentType: true,
  filePath: true,
  verifiedAt: true,
  createdAt: true,
  verifierUser: { select: { id: true, fullName: true } },
} as const

@Injectable()
export class DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async workerExists(id: string): Promise<{ id: string; fullName: string } | null> {
    const row = await this.prisma.worker.findUnique({
      where: { id },
      select: { id: true, fullName: true, deletedAt: true },
    })

    return row && row.deletedAt === null ? { id: row.id, fullName: row.fullName } : null
  }

  async listAll(workerId: string): Promise<DocumentRow[]> {
    return this.prisma.workerDocument.findMany({
      where: { workerId },
      orderBy: { createdAt: 'desc' },
      select: SELECT,
    })
  }

  async byId(workerId: string, id: string): Promise<DocumentRow | null> {
    return this.prisma.workerDocument.findFirst({ where: { id, workerId }, select: SELECT })
  }

  async ofType(workerId: string, documentType: string): Promise<{ id: string } | null> {
    return this.prisma.workerDocument.findFirst({
      where: { workerId, documentType },
      select: { id: true },
    })
  }

  async create(params: {
    workerId: string
    documentType: string
    filePath: string
    userId: string
    roleCode: string
  }): Promise<DocumentRow> {
    const id = uuidv7()

    await this.prisma.$transaction(async (tx) => {
      await tx.workerDocument.create({
        data: {
          id,
          workerId: params.workerId,
          documentType: params.documentType,
          filePath: params.filePath,
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'personal.worker_document',
          entityId: id,
          eventType: 'DOCUMENT_UPLOADED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { workerId: params.workerId, documentType: params.documentType },
        },
      })
    })

    return this.prisma.workerDocument.findUniqueOrThrow({ where: { id }, select: SELECT })
  }

  async verify(params: {
    id: string
    workerId: string
    userId: string
    roleCode: string
  }): Promise<DocumentRow> {
    await this.prisma.$transaction(async (tx) => {
      await tx.workerDocument.update({
        where: { id: params.id },
        data: { verifiedBy: params.userId, verifiedAt: new Date() },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'personal.worker_document',
          entityId: params.id,
          eventType: 'DOCUMENT_VERIFIED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { workerId: params.workerId },
        },
      })
    })

    return this.prisma.workerDocument.findUniqueOrThrow({
      where: { id: params.id },
      select: SELECT,
    })
  }

  async remove(params: {
    id: string
    workerId: string
    userId: string
    roleCode: string
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.workerDocument.delete({ where: { id: params.id } })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'personal.worker_document',
          entityId: params.id,
          eventType: 'DOCUMENT_REMOVED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { workerId: params.workerId },
        },
      })
    })
  }

  async hasTaxId(workerId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ has: boolean }>>`
      SELECT has_tax_id AS has FROM personal.vw_worker WHERE id = ${workerId}::uuid`

    return rows[0]?.has ?? false
  }
}
