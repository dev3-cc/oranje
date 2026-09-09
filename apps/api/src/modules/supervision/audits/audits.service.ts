import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { StorageService } from '../../../infra/storage/index.js'

import {
  AuditDetailRow,
  AuditFilter,
  AuditsRepository,
  NewResponse,
  ResponseChange,
} from './audits.repository.js'
import type { AuditEntity, AuditHeaderEntity, LastAuditPerWorker } from './entities/audit.entity.js'

const PERSONAL_PRESENTATION = 'PERSONAL_PRESENTATION'

export interface AuditBoard {
  data: AuditHeaderEntity[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export interface CreateAuditInput {
  auditType: string
  hotelId: string
  workerId?: string | undefined
  observations?: string | undefined
  responses: NewResponse[]
}

export interface UpdateAuditInput {
  observations?: string | undefined
  responses?: NewResponse[] | undefined
}

export interface QueryAuditsInput extends AuditFilter {
  hotelId?: string | undefined
}

@Injectable()
export class AuditsService {
  constructor(
    private readonly repo: AuditsRepository,
    private readonly storage: StorageService,
  ) {}

  // Un registro sin consecuencia: no toca `personal.worker` ni ningún
  // semáforo, y no escribe al `journal` — su historial es
  // `audit_response_history`.
  async create(dto: CreateAuditInput, user: AuthenticatedUser): Promise<AuditEntity> {
    this.assertHotelScope(dto.hotelId, user)

    if (!(await this.repo.hotelExists(dto.hotelId))) {
      throw new NotFoundException({ code: 'HOTEL_NOT_FOUND', message: 'El hotel no existe' })
    }

    if (dto.auditType === PERSONAL_PRESENTATION) {
      if (!dto.workerId) {
        throw new UnprocessableEntityException({
          code: 'WORKER_REQUIRED',
          message: 'La auditoría de Presentación Personal exige un colaborador',
        })
      }

      if (!(await this.repo.isWorkerAssignedToHotel(dto.workerId, dto.hotelId))) {
        throw new UnprocessableEntityException({
          code: 'WORKER_NOT_ASSIGNED_TO_HOTEL',
          message: 'Este colaborador no tiene asignación activa en ese hotel',
        })
      }
    } else if (dto.workerId) {
      throw new BadRequestException({
        code: 'WORKER_NOT_ALLOWED',
        message: 'La auditoría de Ambiente y Recursos no lleva colaborador',
      })
    }

    this.assertNoDuplicateItems(dto.responses)

    const items = await this.repo.checklistItems(
      dto.auditType,
      dto.responses.map((r) => r.checklistItemId),
    )

    dto.responses.forEach((r, index) => {
      if (!items.has(r.checklistItemId)) {
        throw this.unknownChecklistItem(index, dto.auditType)
      }
    })

    const score = computeScore(
      dto.responses.map((r) => ({ value: r.value, weight: items.get(r.checklistItemId)!.weight })),
    )

    const id = uuidv7()

    await this.repo.create({
      id,
      auditType: dto.auditType,
      hotelId: dto.hotelId,
      workerId: dto.workerId ?? null,
      supervisorUserId: user.id,
      score,
      observations: dto.observations ?? null,
      responses: dto.responses,
      userId: user.id,
    })

    return this.get(id, user)
  }

  // Solo lo que llegue DISTINTO al valor guardado se corrige — cada corrección
  // deja su fila en `audit_response_history`. El score se recalcula con el
  // estado completo YA corregido, en la misma transacción.
  async update(id: string, dto: UpdateAuditInput, user: AuthenticatedUser): Promise<AuditEntity> {
    const row = await this.audit(id)

    this.assertHotelScope(row.hotelId, user)

    if (dto.responses && dto.responses.length > 0) {
      this.assertNoDuplicateItems(dto.responses)

      const items = await this.repo.checklistItems(
        row.auditType,
        dto.responses.map((r) => r.checklistItemId),
      )
      const existingByItem = new Map(row.responses.map((r) => [r.checklistItemId, r]))

      const changes: ResponseChange[] = []

      dto.responses.forEach((r, index) => {
        if (!items.has(r.checklistItemId)) {
          throw this.unknownChecklistItem(index, row.auditType)
        }

        const existing = existingByItem.get(r.checklistItemId)

        if (!existing) {
          throw new UnprocessableEntityException({
            code: 'RESPONSE_NOT_FOUND',
            message: `El reactivo en la posición ${index + 1} no forma parte de esta auditoría`,
          })
        }

        if (existing.value !== r.value) {
          changes.push({
            auditResponseId: existing.id,
            previousValue: existing.value,
            newValue: r.value,
          })
        }
      })

      // El score se recalcula sobre el estado COMPLETO ya corregido, no solo
      // sobre lo que llegó en el body.
      const merged = row.responses.map((existing) => {
        const change = changes.find((c) => c.auditResponseId === existing.id)

        return {
          value: change ? change.newValue : existing.value,
          weight: existing.checklistItem.weight,
        }
      })
      const score = computeScore(merged)

      await this.repo.correct({
        auditId: id,
        observations: dto.observations,
        score,
        changes,
        userId: user.id,
      })
    } else if (dto.observations !== undefined) {
      await this.repo.updateHeader(id, dto.observations, user.id)
    }

    return this.get(id, user)
  }

  async list(query: QueryAuditsInput, user: AuthenticatedUser): Promise<AuditBoard> {
    const hotelId = this.resolveScopeHotel(query.hotelId, user)

    const { rows, total } = await this.repo.findMany(query, hotelId)
    const photos = await this.signPhotos(rows.map((r) => r.worker?.photoPath ?? null))

    return {
      data: rows.map((row) => toHeaderEntity(row, photos)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    }
  }

  async get(id: string, user: AuthenticatedUser): Promise<AuditEntity> {
    const row = await this.audit(id)

    this.assertHotelScope(row.hotelId, user)

    const photos = await this.signPhotos([row.worker?.photoPath ?? null])

    return toDetailEntity(row, photos)
  }

  // Alimenta "tiempo sin auditar" desde la ficha del hotel: cada colaborador
  // con asignación ACTIVA ahí, con la fecha de su última
  // PERSONAL_PRESENTATION (o null si nunca se le ha hecho una).
  async lastPerWorker(hotelId: string, user: AuthenticatedUser): Promise<LastAuditPerWorker[]> {
    this.assertHotelScope(hotelId, user)

    const workers = await this.repo.workersOfHotel(hotelId)
    const lastAudits = await this.repo.lastPersonalAuditByWorker(workers.map((w) => w.id))
    const photos = await this.signPhotos(workers.map((w) => w.photoPath))

    return workers.map((w) => ({
      workerId: w.id,
      workerName: w.fullName,
      photoUrl: w.photoPath ? (photos.get(w.photoPath) ?? null) : null,
      lastAuditedAt: lastAudits.get(w.id)?.toISOString() ?? null,
    }))
  }

  // Mismo patrón que `WorkersService.signPhotos`: firma cada ruta DISTINTA una
  // sola vez, aunque aparezca en varias filas (varias auditorías del mismo
  // colaborador comparten la misma foto).
  private async signPhotos(paths: Array<string | null>): Promise<Map<string, string>> {
    const distinct = [...new Set(paths.filter((p): p is string => p !== null))]
    const urls = await Promise.all(distinct.map((path) => this.storage.signedUrl(path)))

    return new Map(distinct.map((path, index) => [path, urls[index] as string]))
  }

  // `user.hotelId` nulo es el patrón ya establecido (D-09): Manager General y
  // Sistema ven cualquier hotel. Supervisor y Manager de Área quedan acotados
  // al suyo — el 403 dice la verdad, no un "no autorizado" genérico.
  private assertHotelScope(hotelId: string, user: AuthenticatedUser): void {
    if (user.hotelId && user.hotelId !== hotelId) {
      throw new ForbiddenException({
        code: 'HOTEL_OUT_OF_SCOPE',
        message: 'Esta auditoría no es de tu hotel',
      })
    }
  }

  // Un `hotelId` de query fuera del alcance del caller se RECHAZA (mismo
  // criterio que crear/corregir), no se ignora en silencio: un filtro que se
  // descarta sin avisar es peor que un 403 claro.
  private resolveScopeHotel(
    queryHotelId: string | undefined,
    user: AuthenticatedUser,
  ): string | null {
    if (!user.hotelId) {
      return queryHotelId ?? null
    }

    if (queryHotelId && queryHotelId !== user.hotelId) {
      throw new ForbiddenException({
        code: 'HOTEL_OUT_OF_SCOPE',
        message: 'Solo puedes ver auditorías de tu hotel',
      })
    }

    return user.hotelId
  }

  private assertNoDuplicateItems(responses: NewResponse[]): void {
    const ids = responses.map((r) => r.checklistItemId)

    if (new Set(ids).size !== ids.length) {
      throw new UnprocessableEntityException({
        code: 'DUPLICATE_CHECKLIST_ITEM',
        message: 'No repitas un reactivo en la misma auditoría',
      })
    }
  }

  private unknownChecklistItem(index: number, auditType: string): UnprocessableEntityException {
    return new UnprocessableEntityException({
      code: 'CHECKLIST_ITEM_NOT_FOUND',
      message: `El reactivo en la posición ${index + 1} no existe o no es de ${auditType}`,
      details: [{ field: 'responses', value: String(index) }],
    })
  }

  private async audit(id: string): Promise<AuditDetailRow> {
    const row = await this.repo.findById(id)

    if (!row) {
      throw new NotFoundException({ code: 'AUDIT_NOT_FOUND', message: 'La auditoría no existe' })
    }

    return row
  }
}

// El promedio ponderado excluye N/A del todo (ni cuenta ni pesa). Si el
// denominador da 0 (todo N/A), SE RECHAZA con 422 en vez de fingir un 0%: un
// 0 diría "todo mal" y lo que pasó es "nada se evaluó" — son dos hechos
// distintos, y no se inventa el que falta.
function computeScore(responses: Array<{ value: string; weight: Prisma.Decimal }>): number {
  let earned = 0
  let possible = 0

  for (const r of responses) {
    if (r.value === 'N/A') {
      continue
    }

    const weight = r.weight.toNumber()

    possible += weight
    if (r.value === 'CUMPLE') {
      earned += weight
    }
  }

  if (possible === 0) {
    throw new UnprocessableEntityException({
      code: 'AUDIT_ALL_NA',
      message: 'No se puede calificar una auditoría donde todos los reactivos son N/A',
    })
  }

  return Math.round((earned / possible) * 10000) / 100
}

function toHeaderEntity(
  row: {
    id: string
    auditType: string
    hotel: { id: string; name: string }
    worker: { id: string; fullName: string; photoPath: string | null } | null
    supervisorUser: { id: string; fullName: string }
    score: Prisma.Decimal
    observations: string | null
    createdAt: Date
    updatedAt: Date | null
  },
  photos: Map<string, string>,
): AuditHeaderEntity {
  return {
    id: row.id,
    auditType: row.auditType,
    hotel: row.hotel,
    worker: row.worker
      ? {
          id: row.worker.id,
          fullName: row.worker.fullName,
          photoUrl: row.worker.photoPath ? (photos.get(row.worker.photoPath) ?? null) : null,
        }
      : null,
    supervisor: row.supervisorUser,
    score: row.score.toFixed(2),
    observations: row.observations,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? null,
  }
}

function toDetailEntity(row: AuditDetailRow, photos: Map<string, string>): AuditEntity {
  return {
    ...toHeaderEntity(row, photos),
    responses: row.responses.map((r) => ({
      checklistItemId: r.checklistItemId,
      category: r.checklistItem.category,
      label: r.checklistItem.label,
      value: r.value,
    })),
  }
}
