import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { PermissionsService } from '../../identity/index.js'

import type { CreateRequisitionDto } from './dto/create-requisition.dto.js'
import type { QueryRequisitionsDto } from './dto/query-requisitions.dto.js'
import type { PositionEntity, RequisitionEntity } from './entities/requisition.entity.js'
import {
  COVERAGE_LIGHT,
  REQUISITION_LIGHT,
  RequisitionRow,
  RequisitionsRepository,
  URGENCY_LIGHT,
} from './requisitions.repository.js'

const DRAFT = 'APPLE_GREEN'
const AUTHORIZED = 'GREEN'
const EMPTY_COVERAGE = 'GOLD'
const AUTHORIZED_COVERAGE = 'ORANGE'

const URGENT_HOURS = 72
const MEDIUM_HOURS = 120

export interface RequisitionBoard {
  data: RequisitionEntity[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

@Injectable()
export class RequisitionsService {
  constructor(
    private readonly repo: RequisitionsRepository,
    private readonly permissions: PermissionsService,
  ) {}

  async create(dto: CreateRequisitionDto, user: AuthenticatedUser): Promise<RequisitionEntity> {
    if (user.hotelId && user.hotelId !== dto.hotelId) {
      throw new ForbiddenException({
        code: 'HOTEL_OUT_OF_SCOPE',
        message: 'Solo puedes crear requisiciones de tu hotel',
      })
    }

    if (!(await this.repo.hotelExists(dto.hotelId))) {
      throw new NotFoundException({ code: 'HOTEL_NOT_FOUND', message: 'El hotel no existe' })
    }

    await this.assertCatalogs(dto)
    this.assertDepartmentScope(dto, user)

    const [draft, coverage] = await Promise.all([
      this.stateOf(REQUISITION_LIGHT, DRAFT),
      this.stateOf(COVERAGE_LIGHT, EMPTY_COVERAGE),
    ])

    return toEntity(
      await this.repo.create({
        number: await this.nextNumber(),
        hotelId: dto.hotelId,
        stateId: draft.id,
        coverageStateId: coverage.id,
        areaManagerUserId: dto.areaManagerUserId ?? null,
        positions: dto.positions.map((p) => ({
          catalogPositionId: p.catalogPositionId,
          hiringModalityId: p.hiringModalityId,
          hotelDepartmentId: p.hotelDepartmentId,
          englishLevelId: p.englishLevelId ?? null,
          quantity: p.quantity,
          startDate: p.startDate,
          startTime: p.startTime ?? null,
          notes: p.notes ?? null,
        })),
        userId: user.id,
        roleCode: user.roleCode,
      }),
    )
  }

  async list(query: QueryRequisitionsDto, user: AuthenticatedUser): Promise<RequisitionBoard> {
    const seesAll = await this.permissions.can(user.roleCode, 'requisitions', 'read_all')
    const hotelIds = seesAll || !user.hotelId ? null : [user.hotelId]

    const byDepartment = await this.permissions.can(
      user.roleCode,
      'requisitions',
      'read_department',
    )
    const departmentId = byDepartment ? user.departmentId : null

    const { rows, total } = await this.repo.findMany(query, hotelIds, departmentId)

    return {
      data: rows.map(toEntity),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    }
  }

  async get(id: string, user: AuthenticatedUser): Promise<RequisitionEntity> {
    const row = await this.requisition(id)

    if (user.hotelId && row.hotel.id !== user.hotelId) {
      throw new ForbiddenException({
        code: 'HOTEL_OUT_OF_SCOPE',
        message: 'Esta requisición no es de tu hotel',
      })
    }

    return toEntity(row)
  }

  async authorize(id: string, user: AuthenticatedUser): Promise<RequisitionEntity> {
    const row = await this.requisition(id)

    if (user.hotelId && row.hotel.id !== user.hotelId) {
      throw new ForbiddenException({
        code: 'HOTEL_OUT_OF_SCOPE',
        message: 'Esta requisición no es de tu hotel',
      })
    }

    if (row.statusState.code !== DRAFT) {
      throw new ConflictException({
        code: 'REQUISITION_NOT_DRAFT',
        message: `Solo se autoriza una requisición en elaboración, y esta está en ${row.statusState.code}`,
      })
    }

    const authorized = await this.stateOf(REQUISITION_LIGHT, AUTHORIZED)
    const coverage = await this.stateOf(COVERAGE_LIGHT, AUTHORIZED_COVERAGE)
    const now = new Date()

    const urgencyByPosition = await Promise.all(
      row.positions.map(async (p) => ({
        positionId: p.id,
        urgencyStateId: (await this.stateOf(URGENCY_LIGHT, urgencyFor(p.startDate, now))).id,
      })),
    )

    return toEntity(
      await this.repo.authorize({
        id,
        fromStateId: (await this.stateOf(REQUISITION_LIGHT, DRAFT)).id,
        toStateId: authorized.id,
        coverageStateId: coverage.id,
        urgencyByPosition,
        userId: user.id,
        roleCode: user.roleCode,
      }),
    )
  }

  private assertDepartmentScope(dto: CreateRequisitionDto, user: AuthenticatedUser): void {
    if (!user.departmentId) {
      return
    }

    const foreign = dto.positions.find((p) => p.hotelDepartmentId !== user.departmentId)

    if (foreign) {
      throw new ForbiddenException({
        code: 'DEPARTMENT_OUT_OF_SCOPE',
        message: 'Solo puedes pedir posiciones de tu departamento',
      })
    }
  }

  private async assertCatalogs(dto: CreateRequisitionDto): Promise<void> {
    const [positions, modalities, departments, levels] = await Promise.all([
      this.repo.catalogPositions(dto.positions.map((p) => p.catalogPositionId)),
      this.repo.modalities(dto.positions.map((p) => p.hiringModalityId)),
      this.repo.departments(dto.positions.map((p) => p.hotelDepartmentId)),
      this.repo.englishLevels(
        dto.positions.map((p) => p.englishLevelId).filter((v): v is string => Boolean(v)),
      ),
    ])

    for (const [index, p] of dto.positions.entries()) {
      const line = index + 1

      if (!positions.has(p.catalogPositionId)) {
        throw this.unknownCatalog(line, 'catalogPositionId')
      }

      if (!modalities.has(p.hiringModalityId)) {
        throw this.unknownCatalog(line, 'hiringModalityId')
      }

      if (!departments.has(p.hotelDepartmentId)) {
        throw this.unknownCatalog(line, 'hotelDepartmentId')
      }

      if (p.englishLevelId && !levels.has(p.englishLevelId)) {
        throw this.unknownCatalog(line, 'englishLevelId')
      }
    }
  }

  private unknownCatalog(line: number, field: string): UnprocessableEntityException {
    return new UnprocessableEntityException({
      code: 'CATALOG_NOT_FOUND',
      message: `El renglón ${line} apunta a un ${field} que no existe`,
      details: [{ field, value: String(line) }],
    })
  }

  private async nextNumber(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = `${stamp(new Date())}${suffix()}`

      if (!(await this.repo.numberTaken(candidate))) {
        return candidate
      }
    }

    throw new ConflictException({
      code: 'NUMBER_COLLISION',
      message: 'No se pudo generar un número de requisición libre',
    })
  }

  private async stateOf(light: string, code: string): Promise<{ id: string }> {
    const state = await this.repo.stateByCode(light, code)

    if (!state) {
      throw new ConflictException({
        code: 'STATE_NOT_FOUND',
        message: `El estado ${code} no existe en el semáforo ${light}`,
      })
    }

    return state
  }

  private async requisition(id: string): Promise<RequisitionRow> {
    const row = await this.repo.findById(id)

    if (!row) {
      throw new NotFoundException({
        code: 'REQUISITION_NOT_FOUND',
        message: 'La requisición no existe',
      })
    }

    return row
  }
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function suffix(): string {
  const pick = (): string => ALPHABET[Math.floor(Math.random() * ALPHABET.length)] ?? 'A'

  return `${pick()}${pick()}`
}

function stamp(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')

  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
  ].join('')
}

function urgencyFor(startDate: Date, from: Date): string {
  const hours = (startDate.getTime() - from.getTime()) / 3_600_000

  if (hours < URGENT_HOURS) {
    return 'RED'
  }

  return hours <= MEDIUM_HOURS ? 'YELLOW' : 'STRONG_GREEN'
}

function toPosition(p: RequisitionRow['positions'][number]): PositionEntity {
  return {
    id: p.id,
    lineNumber: p.lineNumber,
    position: p.catalogPosition,
    hiringModality: p.hiringModality,
    englishLevel: p.englishLevel,
    department: p.hotelDepartment,
    quantity: p.quantity,
    startDate: p.startDate.toISOString().slice(0, 10),
    startTime: p.startTime?.toISOString().slice(11, 16) ?? null,
    notes: p.notes,
    coverage: p.coverageState,
    urgency: p.urgencyState,
    filled: p.slots.filter((s) => s.status === 'taken').length,
  }
}

function toEntity(row: RequisitionRow): RequisitionEntity {
  const positions = row.positions.map(toPosition)

  return {
    id: row.id,
    number: row.number,
    hotel: row.hotel,
    state: row.statusState,
    areaManagerUserId: row.areaManagerUserId,
    authorizedBy: row.authorizedBy,
    authorizedAt: row.authorizedAt?.toISOString() ?? null,
    inspectorId: row.inspectorId,
    positions,
    totalSlots: positions.reduce((total, p) => total + p.quantity, 0),
    filledSlots: positions.reduce((total, p) => total + p.filled, 0),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? null,
  }
}
