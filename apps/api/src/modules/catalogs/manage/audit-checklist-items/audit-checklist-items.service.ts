import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../../../common/decorators/index.js'
import { PrismaService } from '../../../../infra/prisma/index.js'

import type {
  CreateAuditChecklistItemDto,
  UpdateAuditChecklistItemDto,
} from './dto/audit-checklist-item.dto.js'

export interface AuditChecklistItem {
  id: string
  auditType: string
  category: string
  code: string
  label: string
  weight: string
  ordinal: number
}

const SELECT = {
  id: true,
  auditType: true,
  category: true,
  code: true,
  label: true,
  weight: true,
  ordinal: true,
} as const

/** `Uniforme completo, limpio y planchado` → `UNIFORME_COMPLETO_LIMPIO_Y_PLANCHADO`. */
function codeFromLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * CRUD del catálogo de reactivos (`audit_checklist_item`), separado del
 * genérico de `catalogs:manage`: tiene MÁS campos que un catálogo típico
 * (auditType, category, weight, ordinal) y su único es compuesto
 * `(auditType, code)`, no solo `code` — meterlo al switch genérico habría
 * significado ramificar su DTO y su `create`/`update` con un caso especial
 * casi tan grande como este archivo. Mismo contrato de rutas
 * (`/catalogs/audit-checklist-items[...]`) y mismo criterio de errores.
 */
@Injectable()
export class AuditChecklistItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateAuditChecklistItemDto,
    actor: AuthenticatedUser,
  ): Promise<AuditChecklistItem> {
    try {
      const row = await this.prisma.auditChecklistItem.create({
        data: {
          id: uuidv7(),
          auditType: dto.auditType,
          category: dto.category,
          code: codeFromLabel(dto.label),
          label: dto.label,
          ...(dto.weight !== undefined ? { weight: dto.weight } : {}),
          ordinal: dto.ordinal,
        },
        select: SELECT,
      })

      await this.journal(row.id, 'CHECKLIST_ITEM_CREATED', actor, {
        auditType: row.auditType,
        code: row.code,
        label: row.label,
      })

      return toEntity(row)
    } catch (error) {
      throw this.translate(error)
    }
  }

  async update(
    id: string,
    dto: UpdateAuditChecklistItemDto,
    actor: AuthenticatedUser,
  ): Promise<AuditChecklistItem> {
    const existing = await this.prisma.auditChecklistItem.findUnique({
      where: { id },
      select: SELECT,
    })

    if (!existing) {
      throw this.notFound()
    }

    const data: Prisma.AuditChecklistItemUncheckedUpdateInput = {}

    if (dto.category !== undefined) {
      data.category = dto.category
    }
    if (dto.label !== undefined) {
      data.label = dto.label
      // El código sigue al label: es un identificador derivado, no historia.
      data.code = codeFromLabel(dto.label)
    }
    if (dto.weight !== undefined) {
      data.weight = dto.weight
    }
    if (dto.ordinal !== undefined) {
      data.ordinal = dto.ordinal
    }

    try {
      const row = await this.prisma.auditChecklistItem.update({
        where: { id },
        data,
        select: SELECT,
      })

      await this.journal(id, 'CHECKLIST_ITEM_UPDATED', actor, {
        before: { code: existing.code, label: existing.label },
        after: { code: row.code, label: row.label },
      })

      return toEntity(row)
    } catch (error) {
      throw this.translate(error)
    }
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.auditChecklistItem.findUnique({
      where: { id },
      select: SELECT,
    })

    if (!existing) {
      throw this.notFound()
    }

    try {
      await this.prisma.auditChecklistItem.delete({ where: { id } })
    } catch (error) {
      throw this.translate(error)
    }

    await this.journal(id, 'CHECKLIST_ITEM_DELETED', actor, {
      auditType: existing.auditType,
      code: existing.code,
      label: existing.label,
    })
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: 'CHECKLIST_ITEM_NOT_FOUND',
      message: 'Ese reactivo no existe',
    })
  }

  private translate(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return new ConflictException({
          code: 'CHECKLIST_ITEM_NAME_TAKEN',
          message: 'Ya existe un reactivo con ese texto en esta auditoría',
        })
      }
      if (error.code === 'P2003') {
        return new ConflictException({
          code: 'CATALOG_IN_USE',
          message: 'Hay auditorías con respuestas a este reactivo: no se puede eliminar',
        })
      }
    }

    return error
  }

  private async journal(
    entityId: string,
    eventType: string,
    actor: AuthenticatedUser,
    payload: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.journalEntry.create({
      data: {
        id: uuidv7(),
        entityType: 'catalogs.audit-checklist-items',
        entityId,
        eventType,
        actorUserId: actor.id,
        actorRole: actor.roleCode,
        payload,
      },
    })
  }
}

function toEntity(row: {
  id: string
  auditType: string
  category: string
  code: string
  label: string
  weight: Prisma.Decimal
  ordinal: number
}): AuditChecklistItem {
  return {
    id: row.id,
    auditType: row.auditType,
    category: row.category,
    code: row.code,
    label: row.label,
    weight: row.weight.toFixed(2),
    ordinal: row.ordinal,
  }
}
