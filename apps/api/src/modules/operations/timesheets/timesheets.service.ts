import {
  Logger,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { assignmentStatusLabel, timesheetStatusLabel } from '../../../common/utils/status-labels.js'
import { parsePunchQrPayload } from '../../commercial/hotels/punch-qr.js'
import { NotificationPublisherService } from '../../notifications/index.js'

import type { CreateManualPunchDto, CreatePunchDto } from './dto/create-punch.dto.js'
import { LUNCH_TYPES } from './dto/create-punch.dto.js'
import {
  AssignmentContext,
  DayRow,
  EnsureDayParams,
  PunchRow,
  TimesheetPayPreview,
  TimesheetRow,
  TimesheetsRepository,
} from './timesheets.repository.js'

const OPEN = 'OPEN'
const PENDING = 'PENDING_APPROVAL'
const APPROVED = 'APPROVED'

const CLOCK_IN = 'CLOCK_IN'
const CLOCK_OUT = 'CLOCK_OUT'

const GENERAL_MANAGER = 'ROL-H-03'

/* Tope del listado (una fila por colaborador × requisición × semana, sin
   días). Un hotel no llega a 100 en las semanas que se miran; todos los
   hoteles sí, y cortar ahí escondería semanas sin avisar. */
const HOTEL_LIMIT = 100
const ALL_HOTELS_LIMIT = 2000

export interface PunchEntity {
  id: string
  type: string
  serverAt: string
  deviceAt: string | null
  insideGeofence: boolean | null
  isManual: boolean
  manualReason: string | null
}

export interface PunchResult {
  punch: PunchEntity
  dayId: string
  grossMinutes: number
  hasAnomaly: boolean
}

export interface TimesheetEntity {
  id: string
  worker: { id: string; fullName: string }
  requisitionId: string
  weekStart: string
  weekEnd: string
  status: string
  approvedAt: string | null
  approvedBy: { id: string; fullName: string } | null
  /**
   * La asignación que respalda estas horas. `ACTIVE` admite marcas; `CLOSED`
   * o `CANCELLED` son historia (se aprueban y pagan, pero ya no se captura);
   * `null` cuando no hay ninguna — solo pasa con datos sembrados a mano.
   */
  assignment: { status: 'ACTIVE' | 'CLOSED' | 'CANCELLED'; endsOn: string | null } | null
  days?: DayEntity[]
  totals?: { grossMinutes: number; netMinutes: number; overtimeMinutes: number }
  /**
   * Solo con `timesheet:read_all_hotels` (Contabilidad, el Observador): lo
   * que se le pagaría a esta hoja hoy. Quien solo ve su hotel no recibe esta
   * cifra — es dato de sueldo, no de operación del día a día.
   */
  payPreview?: TimesheetPayPreview | undefined
}

/** Una fila del listado de Timesheets: además, de qué hotel y qué requisición son. */
export interface TimesheetListEntity extends TimesheetEntity {
  hotel: { id: string; name: string }
  requisitionFolio: string
}

/** Filtros del listado. Todos opcionales; el alcance lo pone el permiso. */
export interface ListTimesheetsFilters {
  status?: string | undefined
  /** Lunes de la semana, `AAAA-MM-DD`. */
  weekStart?: string | undefined
  hotelId?: string | undefined
}

export interface DayEntity {
  id: string
  workDate: string
  grossMinutes: number
  netMinutes: number
  lunchDeductionMinutes: number
  actualLunchMinutes: number | null
  overtimeMinutes: number
  isAbsence: boolean
  hasAnomaly: boolean
  /** Turno nocturno emparejado con el día siguiente/anterior — exactamente
      uno puede ser `true`, nunca los dos (Hugo, 2026-10-12). */
  continuesNextDay: boolean
  continuesFromPreviousDay: boolean
  reviewNote: string | null
  dayStatus: { code: string; name: string } | null
  punches: PunchEntity[]
}

/**
 * La progresión del fijo, tal como la describe el Semáforo del Colaborador.
 * El orden importa: se busca por el estado de ORIGEN, así que cada paso solo
 * aplica desde el anterior.
 */
const MORADO = 'PURPLE'
/** Los estados desde los que se puede caer en inasistencia. */
const OPERATIVOS = ['APPLE_GREEN', 'LIGHT_BLUE', 'ORANGE', 'BROWN']
const LIMITE_INASISTENCIAS = 3
/** El vault avisa a Reclutamiento desde la SEGUNDA, no desde la tercera. */
const AVISO_A_RECLUTAMIENTO = 2

const PROGRESION: ReadonlyArray<{ desde: string; hacia: string; días: number }> = [
  { desde: 'STRONG_GREEN', hacia: 'APPLE_GREEN', días: 1 },
  { desde: 'APPLE_GREEN', hacia: 'LIGHT_BLUE', días: 3 },
  { desde: 'LIGHT_BLUE', hacia: 'ORANGE', días: 7 },
]

@Injectable()
export class TimesheetsService {
  private readonly logger = new Logger(TimesheetsService.name)

  constructor(
    private readonly repo: TimesheetsRepository,
    private readonly notifications: NotificationPublisherService,
  ) {}

  async punch(dto: CreatePunchDto, user: AuthenticatedUser): Promise<PunchResult> {
    const assignment = await this.assignment(dto.assignmentId ?? (await this.assignmentToday(user)))

    // La asignación puede llegar en el cuerpo, así que sin esto un colaborador
    // podía ponchar por otro con solo cambiar el id. Quien poncha es el dueño
    // de la asignación: el ponche ajeno es el manual, que es del Supervisor.
    await this.assertOwnAssignment(assignment, user)

    // La evidencia de presencia de Entrada y Salida la decide el HOTEL
    // (Reglas de Negocio, «Método de ponche por hotel»): la foto tomada en el
    // momento, o el QR impreso en el acceso. Las marcas de lunch no llevan.
    const qrVersion = this.assertEvidence(dto, assignment)

    const now = new Date()
    const { dayId, status, ensure } = await this.openDay(assignment, now, user.id)

    this.assertEditable(status)

    if (dayId !== null && (await this.repo.punchExists(dayId, dto.type))) {
      throw new ConflictException({
        code: 'PUNCH_ALREADY_REGISTERED',
        message: `Ya hay una marca ${dto.type} en este día`,
      })
    }

    const inside = assignment.hasCoordinates
      ? await this.repo.insideGeofence(assignment.hotelId, dto.latitude, dto.longitude)
      : null

    if (inside === false) {
      throw new UnprocessableEntityException({
        code: 'OUTSIDE_GEOFENCE',
        message: 'Estás fuera del hotel: pide al Supervisor un ponche manual',
      })
    }

    // Crear el día (si hacía falta) e insertar la marca son un solo hecho:
    // si esto lanza, no queda ningún rastro de un día que nunca tuvo marca.
    const { id, dayId: resolvedDayId } = await this.repo.addPunch({
      ensure,
      type: dto.type,
      latitude: dto.latitude,
      longitude: dto.longitude,
      insideGeofence: inside,
      photoPath: dto.photoPath ?? null,
      qrVersion,
      deviceAt: dto.deviceAt ?? null,
      userId: user.id,
      roleCode: user.roleCode,
    })

    await this.advanceWorkerProgress(assignment)

    return this.afterPunch(resolvedDayId, id)
  }

  async manualPunch(dto: CreateManualPunchDto, user: AuthenticatedUser): Promise<PunchResult> {
    const assignment = await this.assignment(dto.assignmentId)

    // La asignación llega por id en el body: sin esto, un Supervisor marcaba
    // manual sobre la de cualquier hotel (Hugo, 2026-10-12).
    if (user.hotelId && assignment.hotelId !== user.hotelId) {
      throw new ForbiddenException({
        code: 'HOTEL_OUT_OF_SCOPE',
        message: 'Esta asignación es de otro hotel',
      })
    }

    if (user.departmentId && assignment.departmentId !== user.departmentId) {
      throw new ForbiddenException({
        code: 'DEPARTMENT_OUT_OF_SCOPE',
        message: 'Esta asignación es de otro departamento',
      })
    }

    // `dto.workDate` es una fecha-calendario pura ("qué día", elegido por
    // quien captura la marca) que Zod ya coacciona a medianoche UTC — NO es
    // un instante real como el `now()` del ponche normal. `openDay` convierte
    // ese parámetro con `AT TIME ZONE` para decidir la semana del Schedule, y
    // medianoche UTC de un lunes cae en domingo en cualquier hotel detrás de
    // UTC: el Schedule (y el Timesheet que hereda su semana) se abría en la
    // semana ANTERIOR a la marcada (Hugo, 2026-10-14, reproducido en vivo).
    // Mediodía UTC es el mismo día-calendario para cualquier huso horario
    // real (UTC-12 a UTC+14), así que la conversión ya no cruza de día.
    const workDateAtNoon = new Date(`${dto.workDate.toISOString().slice(0, 10)}T12:00:00.000Z`)
    const { dayId, status, ensure } = await this.openDay(assignment, workDateAtNoon, user.id)

    this.assertEditable(status, true)

    if (dayId !== null && (await this.repo.punchExists(dayId, dto.type))) {
      throw new ConflictException({
        code: 'PUNCH_ALREADY_REGISTERED',
        message: `Ya hay una marca ${dto.type} en este día`,
      })
    }

    const { id, dayId: resolvedDayId } = await this.repo.addManualPunch({
      ensure,
      type: dto.type,
      occurredAt: dto.occurredAt,
      reason: dto.reason,
      userId: user.id,
      roleCode: user.roleCode,
    })

    try {
      await this.notifications.publish({
        type: 'PUNCH_CORRECTED',
        title: 'Ponche corregido',
        body: `Tu Supervisor registró una marca manual: ${dto.reason}`.slice(0, 500),
        entity: { type: 'operations.punch_mark', id },
        actorUserId: user.id,
        audience: [{ kind: 'WORKER', workerId: assignment.workerId }],
      })
    } catch {
      // Mejor esfuerzo: que Pub/Sub no responda no revierte la marca.
    }

    /* La marca manual también es asistencia: el vault habla de ASISTIR, no de
       quién capturó la marca. */
    await this.advanceWorkerProgress(assignment)

    return this.afterPunch(resolvedDayId, id)
  }

  /**
   * Corregir una marca YA registrada — no la que falta (`manualPunch`, del
   * Supervisor): esta es del Manager de Área/General (`correct_punch`,
   * sembrado el 2026-10-08 y sin conectar hasta hoy, Hugo 2026-10-10). El
   * alcance es el mismo departamento que ya usa `approve`.
   */
  async correctPunch(
    punchId: string,
    dto: { occurredAt: Date; reason: string },
    user: AuthenticatedUser,
  ): Promise<PunchResult> {
    const context = await this.repo.punchContext(punchId)

    if (!context) {
      throw new NotFoundException({ code: 'PUNCH_NOT_FOUND', message: 'La marca no existe' })
    }

    // Mismo hueco que `approve`: el departamento es catálogo global, así que
    // sin el hotel un GA corregía marcas de otro hotel (Hugo, 2026-10-12).
    if (user.hotelId && context.hotelId !== user.hotelId) {
      throw new ForbiddenException({
        code: 'HOTEL_OUT_OF_SCOPE',
        message: 'Esta marca es de otro hotel',
      })
    }

    if (user.departmentId && context.departmentId !== user.departmentId) {
      throw new ForbiddenException({
        code: 'DEPARTMENT_OUT_OF_SCOPE',
        message: 'Solo corriges las horas de tu departamento',
      })
    }

    this.assertEditable(context.status, true)

    await this.repo.correctPunch({
      punchId,
      type: context.type,
      occurredAt: dto.occurredAt,
      reason: dto.reason,
      previousOccurredAt: context.previousOccurredAt,
      userId: user.id,
      roleCode: user.roleCode,
    })

    try {
      await this.notifications.publish({
        type: 'PUNCH_CORRECTED',
        title: 'Ponche corregido',
        body: `Tu Manager corrigió una marca: ${dto.reason}`.slice(0, 500),
        entity: { type: 'operations.punch_mark', id: punchId },
        actorUserId: user.id,
        audience: [{ kind: 'WORKER', workerId: context.workerId }],
      })
    } catch {
      // Mejor esfuerzo: que Pub/Sub no responda no revierte la corrección.
    }

    return this.afterPunch(context.dayId, punchId)
  }

  // `allHotels` lo decide el controlador por permiso (`read_all_hotels`), nunca
  // un `hotelId` vacío: que la falta de hotel signifique «todos» es justo la
  // lectura doble que dejó los huecos de PR #89.
  // El alcance lo fija el permiso (`allHotels`); los filtros solo ACOTAN dentro
  // de él. Así un hotelId ajeno devuelve vacío y no abre otro hotel.
  async list(
    user: AuthenticatedUser,
    filters: ListTimesheetsFilters = {},
    allHotels = false,
    range?: { from?: string | undefined; to?: string | undefined },
  ): Promise<TimesheetListEntity[]> {
    const rows = await this.repo.listAll({
      scopeHotelId: allHotels ? null : user.hotelId,
      hotelId: filters.hotelId ?? null,
      weekStart: filters.weekStart ?? null,
      departmentId: allHotels || user.roleCode === GENERAL_MANAGER ? null : user.departmentId,
      status: filters.status,
      from: range?.from ?? null,
      to: range?.to ?? null,
      limit: allHotels ? ALL_HOTELS_LIMIT : HOTEL_LIMIT,
    })

    // Dato de sueldo: se calcula solo para quien ve todos los hoteles.
    const previews = allHotels ? await this.repo.payPreview(rows.map((row) => row.id)) : []
    const previewOf = new Map(previews.map((p) => [p.timesheetId, p]))

    return rows.map((row) => ({
      ...toTimesheet(row),
      hotel: row.hotel,
      requisitionFolio: row.requisitionFolio,
      payPreview: previewOf.get(row.id),
    }))
  }

  /**
   * Corrección de Contabilidad sobre la vista previa de pago (Hugo,
   * 2026-10-08): tarifa y reparto de horas, no el monto — el monto se
   * recalcula siempre del resto. Una sola vigente por hoja.
   */
  async setPayOverride(
    id: string,
    dto: { regularMinutes: number; overtimeMinutes: number; payRate: number; reason: string },
    user: AuthenticatedUser,
  ): Promise<TimesheetListEntity> {
    await this.timesheet(id)
    await this.repo.setPayOverride({ timesheetId: id, ...dto, userId: user.id })

    return this.one(id)
  }

  async clearPayOverride(id: string): Promise<TimesheetListEntity> {
    await this.timesheet(id)
    await this.repo.deletePayOverride(id)

    return this.one(id)
  }

  /**
   * La misma fila del listado, para que la pantalla refresque sin recargar
   * todo. Sin acotar por hotel: quien llega aquí es porque ya pudo poner o
   * quitar la corrección (`payroll:generate`, que exige `read_all_hotels`).
   */
  private async one(id: string): Promise<TimesheetListEntity> {
    const rows = await this.repo.listAll({
      scopeHotelId: null,
      hotelId: null,
      weekStart: null,
      departmentId: null,
      status: undefined,
      limit: 1,
      timesheetId: id,
    })
    const [preview] = await this.repo.payPreview([id])

    if (!rows[0]) {
      throw new NotFoundException({ code: 'TIMESHEET_NOT_FOUND', message: 'No existe esa hoja' })
    }

    return {
      ...toTimesheet(rows[0]),
      hotel: rows[0].hotel,
      requisitionFolio: rows[0].requisitionFolio,
      payPreview: preview,
    }
  }

  // Sus horas, con el detalle de cada día y sus marcas: de ahí sale el día de
  // hoy que la pantalla del ponche necesita para saber cuál marca toca.
  //
  // Solo la semana en curso trae detalle; las anteriores van como cabecera,
  // porque cargar cada marca de un año de historial no lo pide nadie.
  async mine(user: AuthenticatedUser): Promise<TimesheetEntity[]> {
    const workerId = await this.repo.workerOfUser(user.id)

    if (workerId === null) {
      throw new NotFoundException({
        code: 'WORKER_NOT_LINKED',
        message: 'Tu cuenta no está ligada a un colaborador',
      })
    }

    const sheets = await this.repo.listOfWorker(workerId)

    return Promise.all(
      sheets.map(async (sheet, index) => (index === 0 ? this.withDays(sheet) : toTimesheet(sheet))),
    )
  }

  private async withDays(sheet: TimesheetRow): Promise<TimesheetEntity> {
    const days = await this.repo.days(sheet.id)

    return {
      ...toTimesheet(sheet),
      days: await Promise.all(days.map(async (d) => toDay(d, await this.repo.punches(d.id)))),
      totals: {
        grossMinutes: days.reduce((t, d) => t + d.grossMinutes, 0),
        netMinutes: days.reduce((t, d) => t + d.netMinutes, 0),
        overtimeMinutes: days.reduce((t, d) => t + d.overtimeMinutes, 0),
      },
    }
  }

  /**
   * `GET /timesheets/:id` por su `@Requires` nunca comprobaba DE QUIÉN era la
   * hoja — cualquiera con `read_department` leía el timesheet de cualquier
   * hotel sabiendo el id. Mismo criterio que `list()`: todos los hoteles sin
   * restricción, o el hotel propio + el departamento (salvo Manager General,
   * que ve todo su hotel) (Hugo, 2026-10-12).
   */
  async getScoped(
    id: string,
    user: AuthenticatedUser,
    allHotels: boolean,
  ): Promise<TimesheetEntity> {
    const sheet = await this.timesheet(id)

    this.assertInScope(sheet, user, allHotels)

    return this.get(id, allHotels)
  }

  private assertInScope(
    sheet: { hotelId: string; departmentId: string | null },
    user: AuthenticatedUser,
    allHotels: boolean,
  ): void {
    if (!allHotels && sheet.hotelId !== user.hotelId) {
      throw new ForbiddenException({
        code: 'HOTEL_OUT_OF_SCOPE',
        message: 'Este Timesheet es de otro hotel',
      })
    }

    const departmentScope =
      allHotels || user.roleCode === GENERAL_MANAGER ? null : user.departmentId

    if (departmentScope && sheet.departmentId !== departmentScope) {
      throw new ForbiddenException({
        code: 'DEPARTMENT_OUT_OF_SCOPE',
        message: 'Este Timesheet es de otro departamento',
      })
    }
  }

  /**
   * Un día sin ponches no tiene fila (`openDay` la crea perezosa al marcar):
   * elegir un estado la crea vacía, igual que una marca la crearía. Un día
   * CON ponches no se marca — ya tiene su propia historia, y marcarlo
   * «Descanso» encima sería mentir sobre lo que pasó (Hugo, 2026-10-12).
   */
  async setDayStatus(
    timesheetId: string,
    workDate: Date,
    dayStatusId: string | null,
    user: AuthenticatedUser,
    allHotels: boolean,
  ): Promise<DayEntity> {
    const sheet = await this.timesheet(timesheetId)

    this.assertInScope(sheet, user, allHotels)
    this.assertEditable(sheet.status, true)

    const existing = await this.repo.findDay(timesheetId, workDate)

    if (existing) {
      const punches = await this.repo.punches(existing.id)

      if (punches.length > 0) {
        throw new UnprocessableEntityException({
          code: 'DAY_HAS_PUNCHES',
          message: 'Este día ya tiene marcas: no se marca como descanso',
        })
      }
    }

    if (dayStatusId && !(await this.repo.dayStatusExists(dayStatusId))) {
      throw new NotFoundException({
        code: 'DAY_STATUS_NOT_FOUND',
        message: 'Ese estado no existe en el catálogo',
      })
    }

    const dayId = await this.repo.setDayStatus({ timesheetId, workDate, dayStatusId })

    return toDay(
      (await this.repo.days(timesheetId)).find((d) => d.id === dayId) ??
        (() => {
          throw new NotFoundException({ code: 'DAY_NOT_FOUND', message: 'El día no existe' })
        })(),
      await this.repo.punches(dayId),
    )
  }

  // `allHotels` lo decide quien llama (`getScoped`), nunca se infiere aquí:
  // es dato de sueldo, igual que en `list()` (Hugo, 2026-10-14: "¿estamos
  // consumiendo los datos del contrato?" — se consumen, pero `get()` nunca
  // los pedía; `GET /timesheets/:id` es justo lo que arma el detalle de
  // cada fila en la pantalla).
  async get(id: string, allHotels = false): Promise<TimesheetEntity> {
    const sheet = await this.timesheet(id)
    const days = await this.repo.days(id)
    const preview = allHotels ? (await this.repo.payPreview([id]))[0] : undefined

    const detailed = await Promise.all(
      days.map(async (d) => toDay(d, await this.repo.punches(d.id))),
    )

    // Un día sin ponches no deja fila: se rellena con un marcador vacío para
    // que la semana se vea completa (Hugo, 2026-10-12) — `id` empieza con
    // `virtual:` a propósito, para que nunca pase por un ParseUUIDPipe.
    const present = new Set(detailed.map((d) => d.workDate))
    const placeholders = Array.from({ length: 7 }, (_item, i) =>
      new Date(sheet.weekStart.getTime() + i * 86_400_000).toISOString().slice(0, 10),
    )
      .filter((date) => !present.has(date))
      .map((workDate): DayEntity => ({
        id: `virtual:${workDate}`,
        workDate,
        grossMinutes: 0,
        netMinutes: 0,
        lunchDeductionMinutes: 0,
        actualLunchMinutes: null,
        overtimeMinutes: 0,
        isAbsence: false,
        hasAnomaly: false,
        continuesNextDay: false,
        continuesFromPreviousDay: false,
        reviewNote: null,
        dayStatus: null,
        punches: [],
      }))

    return {
      ...toTimesheet(sheet),
      days: [...detailed, ...placeholders].sort((a, b) => a.workDate.localeCompare(b.workDate)),
      totals: {
        grossMinutes: days.reduce((t, d) => t + d.grossMinutes, 0),
        netMinutes: days.reduce((t, d) => t + d.netMinutes, 0),
        overtimeMinutes: days.reduce((t, d) => t + d.overtimeMinutes, 0),
      },
      payPreview: preview,
    }
  }

  async submit(id: string, user: AuthenticatedUser): Promise<TimesheetEntity> {
    const sheet = await this.timesheet(id)

    if (sheet.status !== OPEN) {
      throw new ConflictException({
        code: 'TIMESHEET_NOT_OPEN',
        message: `Esta semana ya está ${timesheetStatusLabel(sheet.status)}: no admite cambios`,
      })
    }

    const days = await this.repo.days(id)

    const pending = days.filter((d) => d.hasAnomaly)

    if (pending.length > 0) {
      throw new UnprocessableEntityException({
        code: 'ANOMALIES_PENDING',
        message: `Quedan ${pending.length} días con anomalía sin resolver`,
        details: pending.map((d) => ({
          field: 'workDate',
          value: d.workDate.toISOString().slice(0, 10),
        })),
      })
    }

    // Sin Schedule, un día sin ponches no deja fila (`openDay` la crea
    // perezosa al marcar): "sin marca" y "sin estado" son la misma ausencia.
    // Se exige un estado (Descanso, OFF…) para los 7 días antes de aprobar —
    // la semana no se envía con huecos mudos (Hugo, 2026-10-12).
    const present = new Set(days.map((d) => d.workDate.toISOString().slice(0, 10)))
    const missing = Array.from({ length: 7 }, (_item, i) =>
      new Date(sheet.weekStart.getTime() + i * 86_400_000).toISOString().slice(0, 10),
    ).filter((date) => !present.has(date))

    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        code: 'DAYS_WITHOUT_STATUS',
        message: `Quedan ${missing.length} días sin marca ni estado`,
        details: missing.map((value) => ({ field: 'workDate', value })),
      })
    }

    await this.repo.setStatus({
      id,
      status: PENDING,
      approvedBy: null,
      userId: user.id,
      roleCode: user.roleCode,
      event: 'TIMESHEET_SUBMITTED',
    })

    return this.get(id)
  }

  async approve(id: string, user: AuthenticatedUser): Promise<TimesheetEntity> {
    const sheet = await this.timesheet(id)

    if (sheet.status !== PENDING) {
      throw new ConflictException({
        code: 'TIMESHEET_NOT_PENDING',
        message: `Solo se aprueba una semana enviada a aprobación, y esta está ${timesheetStatusLabel(sheet.status)}`,
      })
    }

    // El departamento es catálogo global (mismo id en todos los hoteles):
    // sin comparar también el hotel, un GA de un hotel aprobaba las horas del
    // mismo departamento en OTRO hotel (Hugo, 2026-10-12).
    if (user.hotelId && sheet.hotelId !== user.hotelId) {
      throw new ForbiddenException({
        code: 'HOTEL_OUT_OF_SCOPE',
        message: 'Esta hoja es de otro hotel',
      })
    }

    if (user.departmentId && sheet.departmentId !== user.departmentId) {
      throw new ForbiddenException({
        code: 'DEPARTMENT_OUT_OF_SCOPE',
        message: 'Solo apruebas las horas de tu departamento',
      })
    }

    await this.repo.setStatus({
      id,
      status: APPROVED,
      approvedBy: user.id,
      userId: user.id,
      roleCode: user.roleCode,
      event: 'HOURS_APPROVED',
    })

    try {
      await this.notifications.publish({
        type: 'HOURS_APPROVED',
        title: 'Horas aprobadas',
        body: 'Tus horas de la semana ya están aprobadas.',
        entity: { type: 'operations.timesheet', id: sheet.id },
        actorUserId: user.id,
        audience: [{ kind: 'WORKER', workerId: sheet.worker.id }],
      })
    } catch {
      // Mejor esfuerzo: que Pub/Sub no responda no revierte la aprobación.
    }

    return this.get(id)
  }

  async reviewDay(dayId: string, note: string, user: AuthenticatedUser): Promise<DayEntity> {
    const day = await this.repo.dayById(dayId)

    if (!day) {
      throw new NotFoundException({ code: 'DAY_NOT_FOUND', message: 'El día no existe' })
    }

    // `dayById` no trae hotel ni departamento: se reusa `timesheet()`, que ya
    // los expone, en vez de dejar este día sin alcance (Hugo, 2026-10-12).
    const sheet = await this.timesheet(day.timesheetId)

    if (user.hotelId && sheet.hotelId !== user.hotelId) {
      throw new ForbiddenException({
        code: 'HOTEL_OUT_OF_SCOPE',
        message: 'Este día es de otro hotel',
      })
    }

    if (user.departmentId && sheet.departmentId !== user.departmentId) {
      throw new ForbiddenException({
        code: 'DEPARTMENT_OUT_OF_SCOPE',
        message: 'Este día es de otro departamento',
      })
    }

    this.assertEditable(day.status, true)

    await this.repo.reviewDay({ dayId, note, userId: user.id, roleCode: user.roleCode })

    const rows = await this.repo.days(day.timesheetId)
    const row = rows.find((d) => d.id === dayId)

    if (!row) {
      throw new NotFoundException({ code: 'DAY_NOT_FOUND', message: 'El día no existe' })
    }

    return toDay(row, await this.repo.punches(dayId))
  }

  /**
   * La progresión del Semáforo del Colaborador, que la dispara el ponche.
   *
   * El vault la describe así: al ASISTIR el día 1 pasa a Verde manzana; al
   * ponchar el tercer día, a Azul claro; al completar 7 días, a Naranja (fijo).
   * Las tres están sembradas a nombre del Sistema y hasta hoy no las disparaba
   * nadie: el semáforo solo se movía a mano (Hugo, 2026-10-09).
   *
   * Se exige el estado de ORIGEN exacto, así que:
   *  - es idempotente — ponchar dos veces el mismo día no avanza dos veces;
   *  - no pisa a nadie — en Café (temporal), Gris, Rojo o Negro no hay paso
   *    que dar, y la escritura ni siquiera encuentra fila;
   *  - no se salta escalones — con 7 días, quien está en Verde manzana pasa
   *    primero a Azul claro, y el siguiente ponche lo lleva a Naranja.
   *
   * Es «mejor esfuerzo»: el ponche ya quedó registrado y un tropiezo aquí no
   * puede revertirlo. Lo peor que pasa es que el color avance en el siguiente.
   */
  /**
   * Las inasistencias: lo único del semáforo que no puede dispararse con un
   * hecho, porque no hay evento cuando algo NO pasa (Hugo, 2026-10-10).
   *
   * Un turno planeado de un día que ya cerró y sin una sola marca es una
   * falta. Se registra en `is_absence` —la columna existía desde agosto y
   * nadie la llenaba, y el propio Catálogo de Notificaciones lo señalaba como
   * el pendiente que impedía mandar el aviso— y el colaborador pasa a Morado,
   * que es lo que el vault manda.
   *
   * Lo que NO hace, por decisión de Hugo: la tercera falta **no veta**. El
   * vault dice «Blacklist automático», pero un trabajo que se equivoca manda a
   * alguien a la Blacklist y solo el Administrador la levanta. Avisa y una
   * persona decide.
   */
  async detectAbsences(tope = 500): Promise<{ registradas: number; avisadas: number }> {
    const candidatos = await this.repo.closedShiftsWithoutPunch(tope)
    const morado = await this.repo.workerStateByCode(MORADO)

    let registradas = 0
    let avisadas = 0

    for (const turno of candidatos) {
      try {
        await this.repo.markAbsence({
          scheduleId: turno.scheduleId,
          workerId: turno.workerId,
          requisitionId: turno.requisitionId,
          weekStart: turno.weekStart,
          weekEnd: turno.weekEnd,
          workDate: turno.workDate,
        })
        registradas += 1

        /* A Morado solo desde un estado operativo: si ya lo movieron, su
           estado de hoy manda y la falta queda registrada igual. */
        const actual = await this.repo.workerState(turno.workerId)
        if (morado && actual && OPERATIVOS.includes(actual.code)) {
          await this.repo.advanceWorkerState({
            workerId: turno.workerId,
            fromStateId: actual.stateId,
            toStateId: morado.id,
          })
        }

        const llevan = await this.repo.absenceCount(turno.workerId)
        await this.avisarInasistencia(turno, llevan)
        if (llevan >= AVISO_A_RECLUTAMIENTO) avisadas += 1
      } catch (error) {
        this.logger.warn(
          `No se pudo registrar la inasistencia de ${turno.workerId} el ${turno.workDate.toISOString().slice(0, 10)}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    }

    return { registradas, avisadas }
  }

  /** Al colaborador con su contador; a Reclutamiento desde la segunda. */
  private async avisarInasistencia(
    turno: { workerId: string; requisitionId: string },
    llevan: number,
  ): Promise<void> {
    try {
      await this.notifications.publish({
        type: 'ABSENCE_RECORDED',
        title: 'Se registró una inasistencia',
        body: `No se registró tu entrada: llevas ${String(llevan)} de ${String(LIMITE_INASISTENCIAS)}.`,
        entity: { type: 'personal.worker', id: turno.workerId },
        audience: [{ kind: 'WORKER', workerId: turno.workerId }],
      })

      if (llevan >= AVISO_A_RECLUTAMIENTO) {
        await this.notifications.publish({
          type: 'ABSENCE_WARNING',
          title: 'Un colaborador acumula inasistencias',
          body: `Lleva ${String(llevan)} de ${String(LIMITE_INASISTENCIAS)}. Al llegar al límite hay que decidir si se veta.`,
          entity: { type: 'personal.worker', id: turno.workerId },
          audience: [{ kind: 'REQUISITION_RECRUITERS', requisitionId: turno.requisitionId }],
        })
      }
    } catch {
      // Mejor esfuerzo: que Pub/Sub no responda no borra la falta registrada.
    }
  }

  private async advanceWorkerProgress(assignment: AssignmentContext): Promise<void> {
    try {
      const actual = await this.repo.workerState(assignment.workerId)
      if (!actual) return

      /*
       * «Morado → estado previo»: el vault dice que el sistema lo detecta
       * cuando el colaborador VUELVE A PONCHAR y lo regresa de inmediato. No
       * es una aprobación de nadie, y volver NO borra la falta: esa ya quedó
       * registrada y sigue contando (Hugo, 2026-10-10).
       */
      if (actual.code === MORADO) {
        const previo = await this.repo.stateBeforePurple(assignment.workerId, actual.stateId)
        if (previo) {
          await this.repo.advanceWorkerState({
            workerId: assignment.workerId,
            fromStateId: actual.stateId,
            toStateId: previo.id,
          })
        }
        return
      }

      const paso = PROGRESION.find((p) => p.desde === actual.code)

      if (!paso) return

      const días = await this.repo.workedDays(assignment.workerId, assignment.requisitionId)
      if (días < paso.días) return

      const destino = await this.repo.workerStateByCode(paso.hacia)
      if (!destino) return

      await this.repo.advanceWorkerState({
        workerId: assignment.workerId,
        fromStateId: actual.stateId,
        toStateId: destino.id,
      })
    } catch (error) {
      this.logger.warn(
        `No se pudo avanzar el semáforo de ${assignment.workerId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  private async afterPunch(dayId: string, punchId: string): Promise<PunchResult> {
    const punches = await this.repo.punches(dayId)
    const own = summarize(punches)

    let grossMinutes = own.grossMinutes
    let hasAnomaly = own.hasAnomaly
    let continuesFromPreviousDay = false

    // Solo se intenta emparejar cuando ESTA marca es la que cierra el turno:
    // trae salida pero no su propia entrada — el caso normal es que la
    // entrada ya exista (de anoche) y la salida llegue ahora (D-?? overnight,
    // Hugo 2026-10-12). El día de la entrada se recalcula aquí mismo; no hace
    // falta volver a tocarlo cuando él mismo reciba una marca después.
    const hasClockOut = punches.some((p) => p.type === CLOCK_OUT)
    const hasClockIn = punches.some((p) => p.type === CLOCK_IN)

    if (own.hasAnomaly && hasClockOut && !hasClockIn) {
      const day = await this.repo.dayForPairing(dayId)
      const previousDay = day
        ? await this.repo.findDay(day.timesheetId, new Date(day.workDate.getTime() - 86_400_000))
        : null
      const previousPunches = previousDay ? await this.repo.punches(previousDay.id) : []
      const split = previousDay ? pairOvernightShift(previousPunches, punches) : null

      if (previousDay && split) {
        await this.repo.recalcDay(previousDay.id, split.previousGrossMinutes, false, {
          continuesNextDay: true,
          continuesFromPreviousDay: false,
        })
        grossMinutes = split.currentGrossMinutes
        hasAnomaly = false
        continuesFromPreviousDay = true
      }
    }

    await this.repo.recalcDay(dayId, grossMinutes, hasAnomaly, {
      continuesNextDay: false,
      continuesFromPreviousDay,
    })

    const punch = punches.find((p) => p.id === punchId)

    if (!punch) {
      throw new ConflictException({
        code: 'PUNCH_NOT_FOUND',
        message: 'La marca no quedó registrada',
      })
    }

    return { punch: toPunch(punch), dayId, grossMinutes, hasAnomaly }
  }

  /**
   * `strict`: además de aprobada, una semana YA ENVIADA a aprobación tampoco
   * admite ediciones del hotel — lo pide Hugo (2026-10-12): una vez enviada,
   * se congela; cualquier corrección después pasa por Oranje. Se activa solo
   * en las tres acciones del HOTEL (marca manual, corregir marca, revisar
   * día); el ponche propio del colaborador (`punch`) no cambia — para
   * entonces la semana ya terminó y no tiene nada que ponchar.
   */
  private assertEditable(status: string, strict = false): void {
    if (status === APPROVED) {
      throw new ConflictException({
        code: 'TIMESHEET_APPROVED',
        message: 'Las horas ya están aprobadas y no se modifican',
      })
    }
    if (strict && status === PENDING) {
      throw new ConflictException({
        code: 'TIMESHEET_ALREADY_SENT',
        message: 'La semana ya se envió a aprobación: no admite más cambios',
      })
    }
  }

  // Read-only a propósito: solo LEE si el timesheet/día ya existen, nunca los
  // crea. Si el timesheet no existe todavía es uno nuevo — su estado por
  // defecto es OPEN y la validación pasa trivialmente; si el día no existe,
  // no puede tener marcas y `punchExists` se salta igual de trivial. Crear
  // de verdad ocurre solo al final, dentro de la transacción que también
  // inserta la marca (ver `addPunch`/`addManualPunch`), para que un intento
  // rechazado no deje una fila fantasma.
  private async openDay(
    assignment: AssignmentContext,
    when: Date,
    userId: string,
  ): Promise<{ dayId: string | null; status: string; ensure: EnsureDayParams }> {
    // Beta «Ponche por Horario» (fecha indefinida): antes, sin Schedule de la
    // semana el ponche se rechazaba (SCHEDULE_MISSING) y alguien tenía que
    // «Agregar turno» a mano primero. Ahora la semana se abre sola — lo que
    // respalda el ponche es el Horario de la posición, no un turno planeado.
    const schedule = await this.repo.ensureSchedule(assignment.hotelId, when, userId)

    const workDate = new Date(`${when.toISOString().slice(0, 10)}T00:00:00Z`)

    const timesheet = await this.repo.findTimesheet({
      workerId: assignment.workerId,
      requisitionId: assignment.requisitionId,
      weekStart: schedule.weekStart,
    })

    const day = timesheet ? await this.repo.findDay(timesheet.id, workDate) : null

    return {
      dayId: day?.id ?? null,
      status: timesheet?.status ?? OPEN,
      ensure: {
        scheduleId: schedule.id,
        workerId: assignment.workerId,
        requisitionId: assignment.requisitionId,
        weekStart: schedule.weekStart,
        weekEnd: schedule.weekEnd,
        workDate,
      },
    }
  }

  // Sin `assignmentId` en el cuerpo se resuelve el turno de HOY del colaborador
  // del token. Es lo que permite ponchar desde la app sin que el cliente
  // conozca su asignación — ningún endpoint suyo la exponía.
  private async assignmentToday(user: AuthenticatedUser): Promise<string> {
    const workerId = await this.repo.workerOfUser(user.id)

    if (workerId === null) {
      throw new NotFoundException({
        code: 'WORKER_NOT_LINKED',
        message: 'Tu cuenta no está ligada a un colaborador',
      })
    }

    const shifts = await this.repo.shiftsToday(workerId)

    if (shifts.length === 0) {
      throw new NotFoundException({
        code: 'NO_SHIFT_TODAY',
        message: 'No tienes turno programado hoy',
      })
    }

    if (shifts.length > 1) {
      throw new ConflictException({
        code: 'MULTIPLE_SHIFTS_TODAY',
        message: 'Tienes más de un turno hoy: di en cuál estás ponchando',
        details: shifts.map((s) => ({ field: 'assignmentId', value: s.assignmentId })),
      })
    }

    return (shifts[0] as { assignmentId: string }).assignmentId
  }

  /**
   * Devuelve la versión del QR escaneado (para guardarla en la marca) o `null`
   * cuando la evidencia es la foto o la marca no la exige.
   */
  private assertEvidence(dto: CreatePunchDto, assignment: AssignmentContext): number | null {
    if (LUNCH_TYPES.includes(dto.type as (typeof LUNCH_TYPES)[number])) return null

    if (assignment.punchMethod !== 'QR') {
      if (!dto.photoPath) {
        throw new UnprocessableEntityException({
          code: 'PHOTO_REQUIRED',
          message: `La marca ${dto.type} necesita foto`,
        })
      }
      return null
    }

    if (!dto.qrCode) {
      throw new UnprocessableEntityException({
        code: 'QR_REQUIRED',
        message: `En este hotel la marca ${dto.type} se registra escaneando el QR del acceso`,
      })
    }

    const parsed = parsePunchQrPayload(dto.qrCode)
    const matches =
      parsed !== null &&
      parsed.hotelId === assignment.hotelId &&
      assignment.punchQrSecret !== null &&
      parsed.secret === assignment.punchQrSecret

    if (!matches) {
      throw new UnprocessableEntityException({
        code: 'QR_INVALID',
        message:
          'Ese código no es el QR vigente de este hotel: pide el impreso actual, o al Supervisor un ponche manual',
      })
    }

    return assignment.punchQrVersion
  }

  private async assertOwnAssignment(
    assignment: AssignmentContext,
    user: AuthenticatedUser,
  ): Promise<void> {
    const worker = await this.repo.workerOfUser(user.id)

    if (worker === null || worker !== assignment.workerId) {
      throw new ForbiddenException({
        code: 'NOT_YOUR_ASSIGNMENT',
        message: 'Solo se poncha sobre una asignación propia',
      })
    }
  }

  private async assignment(id: string): Promise<AssignmentContext> {
    const row = await this.repo.assignment(id)

    if (!row) {
      throw new NotFoundException({
        code: 'ASSIGNMENT_NOT_FOUND',
        message: 'La asignación no existe',
      })
    }

    if (row.status !== 'ACTIVE') {
      throw new UnprocessableEntityException({
        code: 'ASSIGNMENT_NOT_ACTIVE',
        message: `No se poncha sobre una asignación ${assignmentStatusLabel(row.status)}`,
      })
    }

    return row
  }

  private async timesheet(
    id: string,
  ): Promise<TimesheetRow & { departmentId: string | null; hotelId: string }> {
    const row = await this.repo.timesheet(id)

    if (!row) {
      throw new NotFoundException({
        code: 'TIMESHEET_NOT_FOUND',
        message: 'El Timesheet no existe',
      })
    }

    return row
  }
}

export function summarize(punches: PunchRow[]): { grossMinutes: number; hasAnomaly: boolean } {
  const at = (type: string): Date | undefined => punches.find((p) => p.type === type)?.serverAt

  const start = at(CLOCK_IN)
  const end = at(CLOCK_OUT)

  if (!start || !end) {
    return { grossMinutes: 0, hasAnomaly: true }
  }

  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000)

  return { grossMinutes: Math.max(0, minutes), hasAnomaly: minutes <= 0 }
}

/** Tope de un turno real para emparejarlo con el día siguiente — más que
    esto ya no es un turno nocturno, es alguien que de verdad se le olvidó
    ponchar (Hugo, 2026-10-12: "que pasa cuando fue un error de la persona"). */
const MAX_OVERNIGHT_SHIFT_MINUTES = 16 * 60

/**
 * Si el día anterior solo tiene entrada (sin su salida) y este solo tiene
 * salida (sin su propia entrada), pueden ser el MISMO turno partido por la
 * medianoche del día calendario — `workDate` en `openDay` guarda cada marca
 * por SU PROPIA fecha, no por a qué turno pertenece. Devuelve cómo repartir
 * los minutos entre los dos días si el hueco es creíble; `null` si no aplica
 * — ahí el día se queda con su propia anomalía real, sin inventar nada. La
 * medianoche que parte las horas es UTC, igual que `workDate` ya decide en
 * qué día calendario cae cada marca — no la del hotel; una imprecisión ya
 * existente, no una nueva.
 */
function pairOvernightShift(
  previousDayPunches: PunchRow[],
  currentDayPunches: PunchRow[],
): { previousGrossMinutes: number; currentGrossMinutes: number } | null {
  const clockIn = previousDayPunches.find((p) => p.type === CLOCK_IN)
  const clockOut = currentDayPunches.find((p) => p.type === CLOCK_OUT)
  if (!clockIn || !clockOut) return null
  // Cada día ya completo por su cuenta no se toca: emparejar es solo para
  // los dos huérfanos, nunca para "robarle" horas a un día normal.
  if (previousDayPunches.some((p) => p.type === CLOCK_OUT)) return null
  if (currentDayPunches.some((p) => p.type === CLOCK_IN)) return null

  const totalMinutes = Math.round(
    (clockOut.serverAt.getTime() - clockIn.serverAt.getTime()) / 60_000,
  )
  if (totalMinutes <= 0 || totalMinutes > MAX_OVERNIGHT_SHIFT_MINUTES) return null

  const midnight = new Date(`${clockOut.serverAt.toISOString().slice(0, 10)}T00:00:00.000Z`)
  const previousGrossMinutes = Math.round(
    (midnight.getTime() - clockIn.serverAt.getTime()) / 60_000,
  )

  return { previousGrossMinutes, currentGrossMinutes: totalMinutes - previousGrossMinutes }
}

function toPunch(row: PunchRow): PunchEntity {
  return {
    id: row.id,
    type: row.type,
    serverAt: row.serverAt.toISOString(),
    deviceAt: row.deviceAt?.toISOString() ?? null,
    insideGeofence: row.insideGeofence,
    isManual: row.isManual,
    manualReason: row.manualReason,
  }
}

function toDay(row: DayRow, punches: PunchRow[]): DayEntity {
  return {
    id: row.id,
    workDate: new Date(row.workDate).toISOString().slice(0, 10),
    grossMinutes: row.grossMinutes,
    netMinutes: row.netMinutes,
    lunchDeductionMinutes: row.lunchDeductionMinutes,
    actualLunchMinutes: row.actualLunchMinutes,
    overtimeMinutes: row.overtimeMinutes,
    isAbsence: row.isAbsence,
    hasAnomaly: row.hasAnomaly,
    continuesNextDay: row.continuesNextDay,
    continuesFromPreviousDay: row.continuesFromPreviousDay,
    reviewNote: row.reviewNote,
    dayStatus: row.dayStatus,
    punches: punches.map(toPunch),
  }
}

function toTimesheet(row: TimesheetRow): TimesheetEntity {
  return {
    id: row.id,
    worker: row.worker,
    requisitionId: row.requisitionId,
    weekStart: new Date(row.weekStart).toISOString().slice(0, 10),
    weekEnd: new Date(row.weekEnd).toISOString().slice(0, 10),
    status: row.status,
    approvedAt: row.approvedAt ? new Date(row.approvedAt).toISOString() : null,
    approvedBy: row.approvedBy,
    assignment: row.assignment
      ? {
          status: row.assignment.status as 'ACTIVE' | 'CLOSED' | 'CANCELLED',
          endsOn: row.assignment.endsOn,
        }
      : null,
  }
}
