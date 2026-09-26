import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { requisitionStateLabel } from '../../../common/utils/status-labels.js'
import { PlacesService } from '../../../infra/places/index.js'
import { StorageService } from '../../../infra/storage/index.js'
import { PermissionsService } from '../../identity/index.js'
import { NotificationPublisherService } from '../../notifications/index.js'

import type { CreateRequisitionDto } from './dto/create-requisition.dto.js'
import type { QueryRequisitionsDto } from './dto/query-requisitions.dto.js'
import type {
  PositionEntity,
  RequisitionEntity,
  RequisitionJournalEntry,
} from './entities/requisition.entity.js'
import {
  COVERAGE_LIGHT,
  JournalRow,
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
    private readonly notifications: NotificationPublisherService,
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

    // El Inspector no tiene hotel fijo (cubre zona, no hotel): sin `hotelId`
    // en la sesión, el guard de arriba pasa trivial — aquí se acota a las
    // zonas que le asignó su Coordinador (Reglas de Negocio, 2026-09-24).
    if (!user.hotelId && !(await this.repo.hotelInUserZones(dto.hotelId, user.id))) {
      throw new ForbiddenException({
        code: 'HOTEL_OUT_OF_ZONE',
        message: 'Ese hotel no está en ninguna de tus zonas',
      })
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

    /*
     * `read_all` NO levanta el filtro de hotel: esa llave la comparten el
     * Manager General («todos los departamentos de MI hotel») y Reclutamiento
     * («todos los hoteles») — comparten el permiso pero no el alcance. Quien
     * tiene `hotelId` (todo el depto Hotel) se queda SIEMPRE en su hotel; solo
     * quien no tiene hotel fijo (Reclutamiento) ve todos. El Inspector
     * también carece de `hotelId`, pero no tiene `read_all` —así que en vez
     * de "todos", se acota a los hoteles de sus zonas (2026-09-24).
     */
    const hotelIds = user.hotelId
      ? [user.hotelId]
      : readOwn && !seesAll
        ? await this.repo.hotelIdsInUserZones(user.id)
        : null

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

    // Mismo criterio que el listado: sin hotel fijo pero también sin
    // `read_all`, el Inspector solo ve las de sus zonas (2026-09-24).
    if (!user.hotelId && !seesAll && !(await this.repo.hotelInUserZones(row.hotel.id, user.id))) {
      throw new ForbiddenException({
        code: 'HOTEL_OUT_OF_ZONE',
        message: 'Esta requisición no es de ninguna de tus zonas',
      })
    }

    /** Mismo criterio que el listado: el Manager de Área solo ve su departamento (D-09). */
    if (await this.permissions.can(user.roleCode, 'requisitions', 'read_department')) {
      this.assertDepartmentOwnership(row, user, 'Esta requisición es de otro departamento')
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

  /**
   * Sin permiso propio: reutiliza EXACTAMENTE el criterio de `get()` —
   * `Requisitions:read_own/read_all/read_authorized_queue`, alcance de hotel y
   * el borrador oculto para la cola — llamándolo directo. Quien puede leer la
   * requisición puede leer su bitácora; no hay una segunda regla que inventar.
   */
  async journal(id: string, user: AuthenticatedUser): Promise<RequisitionJournalEntry[]> {
    await this.get(id, user)

    return (await this.repo.journal(id)).map(toJournalEntry)
  }

  // Se firman las rutas DISTINTAS, no una por fila: el mismo Supervisor pide
  // muchas requisiciones y su foto se firma una vez. Cada firma es una llamada
  // a IAM.
  private async signCreatorPhotos(rows: RequisitionRow[]): Promise<Map<string, string>> {
    const paths = [
      ...new Set(
        rows.flatMap((r) =>
          [r.creator?.photoPath, r.authorizer?.photoPath, r.inspector?.photoPath].filter(
            (path): path is string => typeof path === 'string',
          ),
        ),
      ),
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
      createdBy: person(row.creator, photos),
      authorizer: person(row.authorizer, photos),
      inspector: person(row.inspector, photos),
    }
  }

  /**
   * Eliminar es pasar a Morado, no borrar la fila: la requisición es historia
   * del hotel.
   *
   * Quién puede es MÁS ESTRECHO que el rol, como el `inspector_id` de la
   * tarjeta de accidente: el borrador solo lo quita SU CREADOR o el Manager
   * General; de la autorización en adelante, el Manager de Área —solo si
   * TODAS las posiciones son de su departamento— o el Manager General, porque
   * a esa altura ya movió al equipo de Reclutamiento (Reglas del Hotel,
   * 2026-09-01).
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
        message: `Una requisición ${requisitionStateLabel(from).toLowerCase()} no se elimina`,
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
    } else {
      if (!reason) {
        throw new UnprocessableEntityException({
          code: 'REASON_REQUIRED',
          message: `Eliminar una requisición ${requisitionStateLabel(from).toLowerCase()} exige un motivo`,
        })
      }

      // El Manager de Área responde por SU departamento: una requisición con
      // una posición ajena no es suya para eliminarla (mismo alcance que al
      // autorizar). El Manager General no trae departamento y pasa.
      this.assertDepartmentOwnership(
        row,
        user,
        'Solo puedes eliminar requisiciones de tu departamento',
      )
    }

    // Eliminar no desasigna gente en silencio.
    const active = await this.repo.activeAssignments(id)

    if (active > 0) {
      throw new ConflictException({
        code: 'REQUISITION_HAS_ASSIGNMENTS',
        message: `Hay ${active} colaborador(es) asignados: libéralos antes de eliminar`,
      })
    }

    const result = this.decorateOne(
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

    // REQ_DELETED: avisa a quien la creó (el Supervisor) que su requisición
    // se eliminó. Solo en la rama distinta a Borrador — ahí quien elimina ES
    // el creador, y no hace falta avisarse a sí mismo.
    if (from !== DRAFT && row.createdBy) {
      try {
        await this.notifications.publish({
          type: 'REQ_DELETED',
          title: 'Requisición eliminada',
          body: `${row.number} fue eliminada${reason ? `: ${reason}` : ''}.`,
          entity: { type: 'demand.requisition', id },
          actorUserId: user.id,
          audience: [{ kind: 'USER', userId: row.createdBy }],
        })
      } catch {
        // Mejor esfuerzo: que Pub/Sub no responda no revierte la eliminación.
      }
    }

    return result
  }

  async authorize(id: string, user: AuthenticatedUser): Promise<RequisitionEntity> {
    const row = await this.requisition(id)

    if (user.hotelId) {
      if (row.hotel.id !== user.hotelId) {
        throw new ForbiddenException({
          code: 'HOTEL_OUT_OF_SCOPE',
          message: 'Esta requisición no es de tu hotel',
        })
      }
      // La firma del Manager de Área vale para SU departamento (D-09); la del
      // Manager General, para todo el hotel. La cola ya filtra, pero el guard
      // vive aquí: un enlace directo no puede saltárselo.
      this.assertDepartmentOwnership(
        row,
        user,
        'Solo puedes autorizar requisiciones de tu departamento',
      )
    } else if (!(await this.repo.hotelInUserZones(row.hotel.id, user.id))) {
      // El Inspector autoriza acotado a los hoteles de su zona, sin
      // restricción de departamento — como el Manager General, porque el
      // Inspector tampoco se divide por departamento (regla reabierta el
      // 2026-09-26, decisión de Hugo).
      throw new ForbiddenException({
        code: 'HOTEL_OUT_OF_ZONE',
        message: 'Ese hotel no está en ninguna de tus zonas',
      })
    }

    if (row.statusState.code !== DRAFT) {
      throw new ConflictException({
        code: 'REQUISITION_NOT_DRAFT',
        message: `Solo se autoriza una requisición en elaboración, y esta está ${row.statusState.name.toLowerCase()}`,
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

    // REQ_INSPECTOR_ASSIGNED: al autorizar, la requisición ya sabe qué
    // Inspector le toca por la zona del hotel (RR-13, el mismo criterio que
    // el accidente laboral). La columna existe desde antes; nadie la llenaba.
    const inspector = row.hotel.zoneId ? await this.repo.inspectorOfZone(row.hotel.zoneId) : null

    const result = this.decorateOne(
      await this.repo.authorize({
        id,
        fromStateId: (await this.stateOf(REQUISITION_LIGHT, DRAFT)).id,
        toStateId: authorized.id,
        coverageStateId: coverage.id,
        urgencyByPosition,
        userId: user.id,
        roleCode: user.roleCode,
        inspectorId: inspector?.id ?? null,
      }),
    )

    if (inspector) {
      try {
        await this.notifications.publish({
          type: 'REQ_INSPECTOR_ASSIGNED',
          title: 'Inspector asignado',
          body: `Te toca la requisición ${row.number}.`,
          entity: { type: 'demand.requisition', id },
          actorUserId: user.id,
          audience: [{ kind: 'USER', userId: inspector.id }],
        })
      } catch {
        // Mejor esfuerzo: que Pub/Sub no responda no revierte la firma.
      }
    }

    // REQ_AUTHORIZED (catálogo de notificaciones): avisa a quien la creó —
    // normalmente el Supervisor — que ya está firmada (RF-H-05). Primer
    // evento de negocio que de verdad se publica; el resto del catálogo
    // (56 tipos) se conecta progresivamente, no todo de una vez.
    if (row.createdBy) {
      try {
        await this.notifications.publish({
          type: 'REQ_AUTHORIZED',
          title: 'Requisición autorizada',
          body: `${row.number} ya está autorizada y lista para Reclutamiento.`,
          entity: { type: 'demand.requisition', id },
          actorUserId: user.id,
          audience: [{ kind: 'USER', userId: row.createdBy }],
        })
      } catch {
        // Mejor esfuerzo: que Pub/Sub no responda no revierte la firma.
      }
    }

    return result
  }

  /**
   * COVERAGE_CLOSURE_REVIEWED: el Líder revisa un cierre que ya pasó solo,
   * en automático, al llenarse el último slot (RF-05) — esto no bloquea ni
   * reabre nada, es un registro de que ya lo vio. Si objeta, el motivo es
   * obligatorio; si lo aprueba, no hace falta explicar por qué.
   */
  async reviewClosure(
    id: string,
    dto: { approved: boolean; reason?: string | undefined },
    user: AuthenticatedUser,
  ): Promise<RequisitionEntity> {
    const row = await this.requisition(id)

    if (row.statusState.code !== 'LIGHT_BLUE') {
      throw new ConflictException({
        code: 'REQUISITION_NOT_CLOSED',
        message: 'Solo se revisa el cierre de una requisición ya cubierta',
      })
    }

    if (!dto.approved && !dto.reason) {
      throw new UnprocessableEntityException({
        code: 'REASON_REQUIRED',
        message: 'Si objetas el cierre, dinos por qué',
      })
    }

    await this.repo.logClosureReview({
      requisitionId: id,
      approved: dto.approved,
      reason: dto.reason ?? null,
      userId: user.id,
      roleCode: user.roleCode,
    })

    try {
      await this.notifications.publish({
        type: 'COVERAGE_CLOSURE_REVIEWED',
        title: dto.approved ? 'Cierre revisado' : 'Cierre objetado',
        body: dto.approved
          ? `${row.number} quedó revisada.`
          : `${row.number}: ${dto.reason ?? ''}`.trim(),
        entity: { type: 'demand.requisition', id },
        actorUserId: user.id,
        audience: [{ kind: 'REQUISITION_RECRUITERS', requisitionId: id }],
      })
    } catch {
      // Mejor esfuerzo: que Pub/Sub no responda no revierte el registro.
    }

    return this.decorateOne(await this.requisition(id))
  }

  /** Quien trae departamento (Supervisor, Manager de Área) solo toca requisiciones cuyas posiciones son de él. */
  private assertDepartmentOwnership(
    row: { positions: Array<{ hotelDepartment: { id: string } }> },
    user: AuthenticatedUser,
    message: string,
  ): void {
    if (
      user.departmentId &&
      row.positions.some((p) => p.hotelDepartment.id !== user.departmentId)
    ) {
      throw new ForbiddenException({ code: 'DEPARTMENT_OUT_OF_SCOPE', message })
    }
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
        message: 'Ese estado no existe en el semáforo',
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

function toJournalEntry(row: JournalRow): RequisitionJournalEntry {
  return {
    id: row.id,
    eventType: row.eventType,
    actorName: row.actor?.fullName ?? null,
    actorRole: row.actorRole,
    payload: row.payload,
    occurredAt: row.occurredAt.toISOString(),
  }
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
/** La misma forma para las tres personas de la ficha: quién la pidió, quién la firmó y el Inspector. */
function person(
  row: { id: string; fullName: string; photoPath: string | null } | null | undefined,
  photos: Map<string, string>,
): { id: string; fullName: string; photoUrl: string | null } | null {
  if (!row) return null
  return {
    id: row.id,
    fullName: row.fullName,
    photoUrl: row.photoPath ? (photos.get(row.photoPath) ?? null) : null,
  }
}

function toEntity(row: RequisitionRow): RequisitionEntity {
  const positions = row.positions.map(toPosition)

  return {
    id: row.id,
    number: row.number,
    hotel: { id: row.hotel.id, name: row.hotel.name, photoUrl: null, timeZone: row.hotel.timeZone },
    createdBy: null,
    authorizer: null,
    inspector: null,
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
