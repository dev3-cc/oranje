import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { PlacesService } from '../../../infra/places/index.js'
import { StorageService } from '../../../infra/storage/index.js'
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
const DELETED = 'PURPLE'
const GENERAL_MANAGER = 'ROL-H-03'
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
    private readonly places: PlacesService,
    private readonly storage: StorageService,
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

    return this.decorateOne(
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

  /**
   * Quién lee depende de CUÁL de los tres permisos tiene (por eso la ruta no
   * lleva `@Requires`, como el territorio): `read_own` (Hotel, acota a su
   * hotel), `read_all` (Líder/Manager de Reclutamiento y GG, todo) y
   * `read_authorized_queue` (Reclutadora: la cola — nunca ve borradores).
   * Antes el guard exigía solo `read_own` y Reclutamiento, con sus permisos
   * sembrados, recibía 403 en su propio módulo.
   */
  async list(query: QueryRequisitionsDto, user: AuthenticatedUser): Promise<RequisitionBoard> {
    const [readOwn, seesAll, queueOnly] = await Promise.all([
      this.permissions.can(user.roleCode, 'requisitions', 'read_own'),
      this.permissions.can(user.roleCode, 'requisitions', 'read_all'),
      this.permissions.can(user.roleCode, 'requisitions', 'read_authorized_queue'),
    ])
    if (!readOwn && !seesAll && !queueOnly) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Tu rol no puede leer requisiciones',
      })
    }

    const hotelIds = seesAll || !user.hotelId ? null : [user.hotelId]

    const byDepartment = await this.permissions.can(
      user.roleCode,
      'requisitions',
      'read_department',
    )
    const departmentId = byDepartment ? user.departmentId : null

    /**
     * Una requisición eliminada no está en ninguna lista ni cola: para el
     * trabajo del día no existe. `GET /:id` sí la sirve, para el enlace viejo
     * y para el journal.
     *
     * La Reclutadora además no ve el borrador: la cola empieza en la
     * autorización.
     */
    const excludeStates = !readOwn && !seesAll ? [DRAFT, DELETED] : [DELETED]

    const { rows, total } = await this.repo.findMany(query, hotelIds, departmentId, excludeStates)

    const photos = await this.signCreatorPhotos(rows)

    return {
      data: rows.map((row) => this.decorate(toEntity(row), row, photos)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    }
  }

  async get(id: string, user: AuthenticatedUser): Promise<RequisitionEntity> {
    const [readOwn, seesAll, queueOnly] = await Promise.all([
      this.permissions.can(user.roleCode, 'requisitions', 'read_own'),
      this.permissions.can(user.roleCode, 'requisitions', 'read_all'),
      this.permissions.can(user.roleCode, 'requisitions', 'read_authorized_queue'),
    ])
    if (!readOwn && !seesAll && !queueOnly) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Tu rol no puede leer requisiciones',
      })
    }

    const row = await this.requisition(id)

    if (user.hotelId && row.hotel.id !== user.hotelId) {
      throw new ForbiddenException({
        code: 'HOTEL_OUT_OF_SCOPE',
        message: 'Esta requisición no es de tu hotel',
      })
    }

    /** Mismo criterio que el listado: la cola no incluye borradores. */
    if (!readOwn && !seesAll && row.statusState.code === DRAFT) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Esta requisición todavía no está autorizada',
      })
    }

    return this.decorateOne(row)
  }

  // Se firman las rutas DISTINTAS, no una por fila: el mismo Supervisor pide
  // muchas requisiciones y su foto se firma una vez. Cada firma es una llamada
  // a IAM.
  private async signCreatorPhotos(rows: RequisitionRow[]): Promise<Map<string, string>> {
    const paths = [
      ...new Set(rows.flatMap((r) => (r.creator?.photoPath ? [r.creator.photoPath] : []))),
    ]
    const urls = await Promise.all(paths.map((path) => this.storage.signedUrl(path)))

    return new Map(
      paths.flatMap((path, index) => {
        const url = urls[index]

        return url ? [[path, url] as [string, string]] : []
      }),
    )
  }

  // Una sola fila: firma la suya y decora. Es el camino de `get`, `create`,
  // `authorize` y `remove`.
  private async decorateOne(row: RequisitionRow): Promise<RequisitionEntity> {
    return this.decorate(toEntity(row), row, await this.signCreatorPhotos([row]))
  }

  private decorate(
    entity: RequisitionEntity,
    row: RequisitionRow,
    photos: Map<string, string>,
  ): RequisitionEntity {
    return {
      ...entity,
      hotel: { ...entity.hotel, photoUrl: this.places.mediaUrl(row.hotel.photoRef) },
      createdBy: row.creator
        ? {
            id: row.creator.id,
            fullName: row.creator.fullName,
            photoUrl: row.creator.photoPath ? (photos.get(row.creator.photoPath) ?? null) : null,
          }
        : null,
    }
  }

  /**
   * Eliminar es pasar a Morado, no borrar la fila: la requisición es historia
   * del hotel.
   *
   * Quién puede es MÁS ESTRECHO que el rol, como el `inspector_id` de la
   * tarjeta de accidente: el borrador solo lo quita SU CREADOR o el Manager
   * General; de la autorización en adelante, solo el Manager General, porque a
   * esa altura ya movió al equipo de Reclutamiento.
   */
  async remove(
    id: string,
    reason: string | null,
    user: AuthenticatedUser,
  ): Promise<RequisitionEntity> {
    const row = await this.requisition(id)

    if (user.hotelId && row.hotel.id !== user.hotelId) {
      throw new ForbiddenException({
        code: 'HOTEL_OUT_OF_SCOPE',
        message: 'Esta requisición no es de tu hotel',
      })
    }

    const from = row.statusState.code

    if (from === DELETED) {
      throw new ConflictException({
        code: 'REQUISITION_ALREADY_DELETED',
        message: 'Esta requisición ya está eliminada',
      })
    }

    const toState = await this.stateOf(REQUISITION_LIGHT, DELETED)
    const fromState = await this.stateOf(REQUISITION_LIGHT, from)

    if (!(await this.repo.transitionAllowed(fromState.id, toState.id, user.roleCode))) {
      throw new ConflictException({
        code: 'TRANSITION_NOT_ALLOWED',
        message: `Una requisición en ${from} no se elimina`,
      })
    }

    if (from === DRAFT) {
      // El borrador es de quien lo escribió. El Manager General entra igual:
      // es quien responde por el hotel entero.
      if (row.createdBy !== user.id && user.roleCode !== GENERAL_MANAGER) {
        throw new ForbiddenException({
          code: 'NOT_YOUR_DRAFT',
          message: 'Este borrador lo creó alguien más',
        })
      }
    } else if (!reason) {
      throw new UnprocessableEntityException({
        code: 'REASON_REQUIRED',
        message: `Eliminar una requisición en ${from} exige un motivo`,
      })
    }

    // Eliminar no desasigna gente en silencio.
    const active = await this.repo.activeAssignments(id)

    if (active > 0) {
      throw new ConflictException({
        code: 'REQUISITION_HAS_ASSIGNMENTS',
        message: `Hay ${active} colaborador(es) asignados: libéralos antes de eliminar`,
      })
    }

    return this.decorateOne(
      await this.repo.remove({
        id,
        fromStateId: fromState.id,
        toStateId: toState.id,
        fromCode: from,
        reason: from === DRAFT ? (reason ?? null) : reason,
        userId: user.id,
        roleCode: user.roleCode,
      }),
    )
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

    return this.decorateOne(
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

// La foto del hotel se COMPONE (D-34) y la del creador se FIRMA (D-30): son
// dos mecanismos distintos porque el binario de una es de Google y el de la
// otra es nuestro.
function toEntity(row: RequisitionRow): RequisitionEntity {
  const positions = row.positions.map(toPosition)

  return {
    id: row.id,
    number: row.number,
    hotel: { id: row.hotel.id, name: row.hotel.name, photoUrl: null },
    createdBy: null,
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
