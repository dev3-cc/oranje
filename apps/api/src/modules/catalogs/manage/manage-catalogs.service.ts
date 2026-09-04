import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { PrismaService } from '../../../infra/prisma/index.js'
import type { CatalogItem } from '../read/catalogs.service.js'

import type { CreateCatalogItemDto, UpdateCatalogItemDto } from './dto/manage-catalog.dto.js'

/**
 * Los catálogos administrables desde la app. Zonas y semáforos quedan FUERA a
 * propósito: las zonas amarran territorio e inspectores (RR-13) y los
 * semáforos son máquinas de estado del seed, no listas.
 */
export const MANAGED_CATALOGS = [
  'hotel-departments',
  'positions',
  'hiring-modalities',
  'english-levels',
] as const

export type ManagedCatalog = (typeof MANAGED_CATALOGS)[number]

/** `Front Desk` → `FRONT_DESK`; `Niñera` → `NINERA`. El código es derivado. */
function codeFromName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

interface CatalogDelegate {
  findUnique(args: {
    where: { id?: string; code?: string }
    select: { id: true; code: true; name: true }
  }): Promise<CatalogItem | null>
  create(args: {
    data: Record<string, unknown>
    select: { id: true; code: true; name: true }
  }): Promise<CatalogItem>
  update(args: {
    where: { id: string }
    data: Record<string, unknown>
    select: { id: true; code: true; name: true }
  }): Promise<CatalogItem>
  delete(args: { where: { id: string } }): Promise<unknown>
}

/**
 * CRUD de catálogos para el Administrador (`catalogs:manage`).
 *
 * El código se deriva del nombre y el empate lo decide el único de `code` en
 * la base, no un SELECT previo. Eliminar es DELETE de verdad — pero una fila
 * referenciada (una posición con requisiciones, un departamento con puestos)
 * la protege la FK: el 23503/P2003 del motor se traduce a 409 CATALOG_IN_USE.
 */
@Injectable()
export class ManageCatalogsService {
  constructor(private readonly prisma: PrismaService) {}

  private delegate(catalog: ManagedCatalog): CatalogDelegate {
    switch (catalog) {
      case 'hotel-departments':
        return this.prisma.hotelDepartment as unknown as CatalogDelegate
      case 'positions':
        return this.prisma.catalogPosition as unknown as CatalogDelegate
      case 'hiring-modalities':
        return this.prisma.hiringModality as unknown as CatalogDelegate
      case 'english-levels':
        return this.prisma.englishLevel as unknown as CatalogDelegate
    }
  }

  assertManaged(catalog: string): asserts catalog is ManagedCatalog {
    if (!(MANAGED_CATALOGS as readonly string[]).includes(catalog)) {
      throw new NotFoundException({
        code: 'CATALOG_UNKNOWN',
        message: 'Ese catálogo no se administra desde aquí',
      })
    }
  }

  async create(
    catalog: ManagedCatalog,
    dto: CreateCatalogItemDto,
    actor: AuthenticatedUser,
  ): Promise<CatalogItem> {
    const data: Record<string, unknown> = {
      id: uuidv7(),
      code: codeFromName(dto.name),
      name: dto.name,
    }

    if (catalog === 'positions') {
      if (!dto.hotelDepartmentId) {
        throw new UnprocessableEntityException({
          code: 'DEPARTMENT_REQUIRED',
          message: 'Una posición pertenece a un departamento: elige a cuál',
        })
      }
      data['hotelDepartmentId'] = dto.hotelDepartmentId
    }

    try {
      const row = await this.delegate(catalog).create({
        data,
        select: { id: true, code: true, name: true },
      })
      await this.journal(catalog, row.id, 'CATALOG_ITEM_CREATED', actor, {
        code: row.code,
        name: row.name,
      })
      return row
    } catch (error) {
      throw this.translate(error, catalog)
    }
  }

  async update(
    catalog: ManagedCatalog,
    id: string,
    dto: UpdateCatalogItemDto,
    actor: AuthenticatedUser,
  ): Promise<CatalogItem> {
    const existing = await this.delegate(catalog).findUnique({
      where: { id },
      select: { id: true, code: true, name: true },
    })
    if (!existing) throw this.notFound()

    const data: Record<string, unknown> = {}
    if (dto.name !== undefined) {
      data['name'] = dto.name
      /* El código sigue al nombre: es un identificador derivado, no historia. */
      data['code'] = codeFromName(dto.name)
    }
    if (catalog === 'positions' && dto.hotelDepartmentId !== undefined) {
      data['hotelDepartmentId'] = dto.hotelDepartmentId
    }

    try {
      const row = await this.delegate(catalog).update({
        where: { id },
        data,
        select: { id: true, code: true, name: true },
      })
      await this.journal(catalog, id, 'CATALOG_ITEM_UPDATED', actor, {
        before: { code: existing.code, name: existing.name },
        after: { code: row.code, name: row.name },
      })
      return row
    } catch (error) {
      throw this.translate(error, catalog)
    }
  }

  async remove(catalog: ManagedCatalog, id: string, actor: AuthenticatedUser): Promise<void> {
    const existing = await this.delegate(catalog).findUnique({
      where: { id },
      select: { id: true, code: true, name: true },
    })
    if (!existing) throw this.notFound()

    try {
      await this.delegate(catalog).delete({ where: { id } })
    } catch (error) {
      throw this.translate(error, catalog)
    }
    await this.journal(catalog, id, 'CATALOG_ITEM_DELETED', actor, {
      code: existing.code,
      name: existing.name,
    })
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: 'CATALOG_ITEM_NOT_FOUND',
      message: 'Esa fila del catálogo no existe',
    })
  }

  /** Los errores del motor con su significado de negocio, no un 500 mudo. */
  private translate(error: unknown, catalog: ManagedCatalog): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return new ConflictException({
          code: 'CATALOG_NAME_TAKEN',
          message: 'Ya existe una fila con ese nombre en el catálogo',
        })
      }
      if (error.code === 'P2003') {
        return new ConflictException({
          code: 'CATALOG_IN_USE',
          message:
            catalog === 'hotel-departments'
              ? 'El departamento tiene posiciones u operación colgando de él: no se puede eliminar'
              : 'Hay requisiciones o colaboradores usando esta fila: no se puede eliminar',
        })
      }
    }
    return error
  }

  private async journal(
    catalog: ManagedCatalog,
    entityId: string,
    eventType: string,
    actor: AuthenticatedUser,
    payload: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.journalEntry.create({
      data: {
        id: uuidv7(),
        entityType: `catalogs.${catalog}`,
        entityId,
        eventType,
        actorUserId: actor.id,
        actorRole: actor.roleCode,
        payload,
      },
    })
  }
}
