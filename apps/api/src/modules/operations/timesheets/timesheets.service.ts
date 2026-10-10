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
  /**
   * La asignación que respalda estas horas. `ACTIVE` admite marcas; `CLOSED`
   * o `CANCELLED` son historia (se aprueban y pagan, pero ya no se captura);
   * `null` cuando no hay ninguna — solo pasa con datos sembrados a mano.
   */
  assignment: { status: 'ACTIVE' | 'CLOSED' | 'CANCELLED'; endsOn: string | null } | null
  days?: DayEntity[]
  totals?: { grossMinutes: number; netMinutes: number; overtimeMinutes: number }
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
  reviewNote: string | null
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
    const { dayId, status, ensure } = await this.openDay(assignment, dto.workDate, user.id)

    this.assertEditable(status)

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

  // `allHotels` lo decide el controlador por permiso (`read_all_hotels`), nunca
  // un `hotelId` vacío: que la falta de hotel signifique «todos» es justo la
  // lectura doble que dejó los huecos de PR #89.
  async list(
    user: AuthenticatedUser,
    status?: string,
    allHotels = false,
    range?: { from?: string | undefined; to?: string | undefined },
  ): Promise<TimesheetEntity[]> {
    const rows = await this.repo.listAll({
      hotelId: allHotels ? null : user.hotelId,
      departmentId: allHotels || user.roleCode === GENERAL_MANAGER ? null : user.departmentId,
      status,
      from: range?.from ?? null,
      to: range?.to ?? null,
      limit: allHotels ? ALL_HOTELS_LIMIT : HOTEL_LIMIT,
    })

    return rows.map(toTimesheet)
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

  async get(id: string): Promise<TimesheetEntity> {
    const sheet = await this.timesheet(id)
    const days = await this.repo.days(id)

    const detailed = await Promise.all(
      days.map(async (d) => toDay(d, await this.repo.punches(d.id))),
    )

    return {
      ...toTimesheet(sheet),
      days: detailed,
      totals: {
        grossMinutes: days.reduce((t, d) => t + d.grossMinutes, 0),
        netMinutes: days.reduce((t, d) => t + d.netMinutes, 0),
        overtimeMinutes: days.reduce((t, d) => t + d.overtimeMinutes, 0),
      },
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

    const pending = (await this.repo.days(id)).filter((d) => d.hasAnomaly)

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

    this.assertEditable(day.status)

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
    const { grossMinutes, hasAnomaly } = summarize(punches)

    await this.repo.recalcDay(dayId, grossMinutes, hasAnomaly)

    const punch = punches.find((p) => p.id === punchId)

    if (!punch) {
      throw new ConflictException({
        code: 'PUNCH_NOT_FOUND',
        message: 'La marca no quedó registrada',
      })
    }

    return { punch: toPunch(punch), dayId, grossMinutes, hasAnomaly }
  }

  private assertEditable(status: string): void {
    if (status === APPROVED) {
      throw new ConflictException({
        code: 'TIMESHEET_APPROVED',
        message: 'Las horas ya están aprobadas y no se modifican',
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

  private async timesheet(id: string): Promise<TimesheetRow & { departmentId: string | null }> {
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
    reviewNote: row.reviewNote,
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
    assignment: row.assignment
      ? {
          status: row.assignment.status as 'ACTIVE' | 'CLOSED' | 'CANCELLED',
          endsOn: row.assignment.endsOn,
        }
      : null,
  }
}
