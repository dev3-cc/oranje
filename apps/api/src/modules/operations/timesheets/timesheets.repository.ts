import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

export interface AssignmentContext {
  id: string
  status: string
  workerId: string
  workerName: string
  hotelId: string
  requisitionId: string
  departmentId: string
  geofenceRadiusM: number | null
  hasCoordinates: boolean
  /** SELFIE | QR: qué evidencia exige el hotel de esta asignación. */
  punchMethod: string
  punchQrSecret: string | null
  punchQrVersion: number
}

export interface DayRow {
  id: string
  workDate: Date
  grossMinutes: number
  lunchDeductionMinutes: number
  overtimeMinutes: number
  netMinutes: number
  actualLunchMinutes: number | null
  isAbsence: boolean
  hasAnomaly: boolean
  /** Turno nocturno emparejado con el siguiente/anterior día — ver D-?? en el
      Prisma schema (`TimesheetDay.continuesNextDay`). */
  continuesNextDay: boolean
  continuesFromPreviousDay: boolean
  reviewNote: string | null
  dayStatus: { code: string; name: string } | null
}

export interface PunchRow {
  id: string
  type: string
  serverAt: Date
  deviceAt: Date | null
  insideGeofence: boolean | null
  isManual: boolean
  manualReason: string | null
}

export interface TimesheetRow {
  id: string
  weekStart: Date
  weekEnd: Date
  status: string
  approvedAt: Date | null
  approvedBy: { id: string; fullName: string } | null
  worker: { id: string; fullName: string }
  requisitionId: string
  /** La asignación que respalda al timesheet (ver `ASSIGNMENT_OF_TIMESHEET`). */
  assignment: { status: string; endsOn: string | null } | null
}

/** Una fila del listado: el hotel y el folio de la requisición, para la pantalla. */
export interface TimesheetListRow extends TimesheetRow {
  hotel: { id: string; name: string }
  requisitionFolio: string
}

/**
 * Lo que se le pagaría a esta hoja hoy, calculado en vivo (nada se guarda
 * aquí): mismas 40 h por requisición y la misma cascada de tarifa que usa la
 * corrida de pago real (`PaymentRunsRepository`), para que la vista previa de
 * Contabilidad y el consolidado final nunca se contradigan.
 */
export interface TimesheetPayPreview {
  timesheetId: string
  regularMinutes: number
  overtimeMinutes: number
  /** `null` = sin tarifa resuelta (sin contrato ni rate interno): no se puede estimar. */
  payRate: string | null
  isInternalRate: boolean
  /** El multiplicador que se aplicaría a las horas extra; `null` junto con `payRate`. */
  overtimeMultiplier: number | null
  /** Bruto: horas + reembolsos YA incluidos. `null` sin tarifa resuelta. */
  subtotal: string | null
  /** Descuentos YA incluidos (gastos que Oranje paga y le descuenta). */
  deductionAmount: string
  /** `subtotal - deductionAmount`; `null` cuando `subtotal` también lo es. */
  netAmount: string | null
  /** Si Contabilidad corrigió tarifa y/o reparto de horas (2026-10-08). */
  isOverridden: boolean
  overrideReason: string | null
  /** Lo que el hotel paga a Oranje por esta hoja — SIEMPRE del contrato,
      nunca de un rate interno (Hugo, 2026-10-14: "pay rate y bill, lado a
      lado"). `null` sin contrato ni tarifa para esa posición. */
  billRate: string | null
  billSubtotal: string | null
  /**
   * Cuándo se tocó por última vez el contrato (términos o alguna tarifa) que
   * resolvió `payRate`/`billRate` — `null` sin contrato o si nunca se editó.
   * Comparado contra `approvedAt` de la hoja (Hugo, 2026-10-16): si el
   * contrato cambió DESPUÉS de que el hotel ya aprobó la semana, lo que se
   * ve aquí es el cálculo NUEVO, no el que se aprobó — y eso se avisa.
   */
  contractUpdatedAt: Date | null
}

// La asignación de ESTA persona en ESTA requisición. El timesheet no la guarda
// (apunta a colaborador y requisición), así que se resuelve al leer: la ACTIVA
// si la hay; si no, la más reciente (cerrada o cancelada), para que la pantalla
// sepa que las horas son historia y no ofrezca capturar marcas. `endsOn` es el
// último día INCLUSIVO de la vigencia; `null` en una asignación fija.
const ASSIGNMENT_OF_TIMESHEET = Prisma.sql`
  (SELECT jsonb_build_object(
            'status', a.status,
            'endsOn', CASE WHEN upper_inf(a.validity) THEN NULL
                           ELSE (upper(a.validity) - 1)::text END)
     FROM coverage.assignment a
     JOIN demand.slot s         ON s.id = a.slot_id
     JOIN demand."position" p   ON p.id = s.position_id
    WHERE a.worker_id = t.worker_id
      AND p.requisition_id = t.requisition_id
    ORDER BY (a.status = 'ACTIVE') DESC, upper(a.validity) DESC NULLS FIRST
    LIMIT 1) AS assignment`

// Quién aprobó, no solo cuándo (Hugo, 2026-10-14: "un tooltip de quién fue").
// `approved_by` es la única firma que la tabla guarda — no hay quién envió,
// el `status` pasa a PENDING_APPROVAL sin registrar actor.
const APPROVED_BY_OF_TIMESHEET = Prisma.sql`
  (SELECT jsonb_build_object('id', au.id, 'fullName', au.full_name)
     FROM identity."user" au
    WHERE au.id = t.approved_by) AS "approvedBy"`

// Lo que hace falta para crear el timesheet/día si todavía no existen — se
// resuelve ANTES de validar (lectura), y solo se usa DENTRO de la transacción
// que también inserta la marca, para que crear y ponchar sean un solo hecho.
export interface EnsureDayParams {
  scheduleId: string
  workerId: string
  requisitionId: string
  weekStart: Date
  weekEnd: Date
  workDate: Date
}

@Injectable()
export class TimesheetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // La cuenta de un colaborador puede no existir: en Fase 1 todavia no la tiene.
  // Mientras dure la migracion de correo, la cuenta vieja tambien resuelve
  // (Worker.legacyUserId, D-XX).
  async workerOfUser(userId: string): Promise<string | null> {
    const row = await this.prisma.worker.findFirst({
      where: { OR: [{ userId }, { legacyUserId: userId }], deletedAt: null },
      select: { id: true },
    })

    return row?.id ?? null
  }

  // El turno de HOY de un colaborador, con la fecha LOCAL DEL HOTEL: a las
  // 23:00 en Cancun ya es el dia siguiente en UTC, y el turno se buscaria mal.
  //
  // Beta «Ponche por Horario» (fecha indefinida, Reglas de Negocio): ya no se
  // resuelve por operations.schedule_entry (nadie lo planea) sino por la
  // asignación ACTIVA cuya posición ya empezó — el Horario de la posición es
  // lo que hoy respalda el ponche, no un turno capturado a mano.
  //
  // Devuelve todas las que apliquen y no la primera: dos asignaciones activas
  // el mismo día siguen siendo posibles (otro hotel, por ejemplo) — quien
  // decide que hacer con eso es el servicio.
  async shiftsToday(workerId: string): Promise<Array<{ assignmentId: string }>> {
    return this.prisma.$queryRaw<Array<{ assignmentId: string }>>`
      SELECT a.id AS "assignmentId"
        FROM coverage.assignment a
        JOIN demand.slot s          ON s.id = a.slot_id
        JOIN demand."position" p    ON p.id = s.position_id
        JOIN demand.requisition r   ON r.id = p.requisition_id
        JOIN commercial.hotel h     ON h.id = r.hotel_id
       WHERE a.worker_id = ${workerId}::uuid
         AND a.status = 'ACTIVE'
         AND p.start_time IS NOT NULL
         AND p.start_date <= (now() AT TIME ZONE h.time_zone)::date
       ORDER BY a.id`
  }

  // Crea la semana (lunes a domingo, hora local del hotel) si todavía no
  // existe — antes de la beta, esto lo hacía un humano con «Agregar turno»;
  // ahora abrir el día lo dispara solo. `ON CONFLICT DO NOTHING` + relectura
  // absorbe la carrera de dos marcas simultáneas del mismo hotel.
  async ensureSchedule(
    hotelId: string,
    when: Date,
    userId: string,
  ): Promise<{ id: string; weekStart: Date; weekEnd: Date }> {
    const existing = await this.scheduleOf(hotelId, when)
    if (existing) return existing

    const id = uuidv7()

    await this.prisma.$executeRaw`
      INSERT INTO operations.schedule (id, hotel_id, week_start, week_end, created_by)
      SELECT ${id}::uuid,
             h.id,
             date_trunc('week', (${when}::timestamptz AT TIME ZONE h.time_zone))::date,
             date_trunc('week', (${when}::timestamptz AT TIME ZONE h.time_zone))::date + 6,
             ${userId}::uuid
        FROM commercial.hotel h
       WHERE h.id = ${hotelId}::uuid
      ON CONFLICT (hotel_id, week_start) DO NOTHING`

    const created = await this.scheduleOf(hotelId, when)

    if (!created) {
      throw new Error('No se pudo abrir la semana del Schedule')
    }

    return created
  }

  async assignment(id: string): Promise<AssignmentContext | null> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string
        status: string
        workerId: string
        workerName: string
        hotelId: string
        requisitionId: string
        departmentId: string
        geofenceRadiusM: number | null
        hasCoordinates: boolean
        punchMethod: string
        punchQrSecret: string | null
        punchQrVersion: number
      }>
    >`
      SELECT a.id,
             a.status,
             a.worker_id            AS "workerId",
             w.full_name            AS "workerName",
             r.hotel_id             AS "hotelId",
             r.id                   AS "requisitionId",
             p.hotel_department_id  AS "departmentId",
             h.geofence_radius_m    AS "geofenceRadiusM",
             (h.coordinates IS NOT NULL) AS "hasCoordinates",
             h.punch_method         AS "punchMethod",
             h.punch_qr_secret      AS "punchQrSecret",
             h.punch_qr_version     AS "punchQrVersion"
        FROM coverage.assignment a
        JOIN personal.worker w    ON w.id = a.worker_id
        JOIN demand.slot s        ON s.id = a.slot_id
        JOIN demand."position" p  ON p.id = s.position_id
        JOIN demand.requisition r ON r.id = p.requisition_id
        JOIN commercial.hotel h   ON h.id = r.hotel_id
       WHERE a.id = ${id}::uuid`

    return rows[0] ?? null
  }

  async insideGeofence(
    hotelId: string,
    latitude: number,
    longitude: number,
  ): Promise<boolean | null> {
    const rows = await this.prisma.$queryRaw<Array<{ inside: boolean | null }>>`
      SELECT ST_DWithin(
               h.coordinates,
               ST_SetSRID(ST_MakePoint(${longitude}::float8, ${latitude}::float8), 4326)::geography,
               COALESCE(h.geofence_radius_m, 0)::float8
             ) AS inside
        FROM commercial.hotel h
       WHERE h.id = ${hotelId}::uuid`

    return rows[0]?.inside ?? null
  }

  // El dia se lee en la zona del HOTEL, no en UTC — el mismo criterio con el
  // que `ensureSchedule` calcula `week_start`/`week_end` al crear. Compararlo
  // contra la fecha UTC cruda (como hacia antes) rompia el primer ponche de
  // un lunes en cualquier hotel detras de UTC: medianoche UTC del lunes cae
  // en domingo en hora local, `date_trunc('week', ...)` trunca a la semana
  // ANTERIOR al crear, y la busqueda con la fecha UTC nunca la encontraba
  // (Hugo, 2026-10-14, reproducido en vivo con Fairfield/America-New_York).
  async scheduleOf(
    hotelId: string,
    workDate: Date,
  ): Promise<{ id: string; weekStart: Date; weekEnd: Date } | null> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; weekStart: Date; weekEnd: Date }>>`
      SELECT s.id, s.week_start AS "weekStart", s.week_end AS "weekEnd"
        FROM operations.schedule s
        JOIN commercial.hotel h ON h.id = s.hotel_id
       WHERE s.hotel_id = ${hotelId}::uuid
         AND (${workDate}::timestamptz AT TIME ZONE h.time_zone)::date BETWEEN s.week_start AND s.week_end
       LIMIT 1`

    return rows[0] ?? null
  }

  // Read-only: si el timesheet no existe todavía, no hay nada que crear para
  // saber su estado — uno nuevo nace OPEN, y eso lo decide el servicio.
  async findTimesheet(params: {
    workerId: string
    requisitionId: string
    weekStart: Date
  }): Promise<{ id: string; status: string } | null> {
    return this.prisma.timesheet.findFirst({
      where: {
        workerId: params.workerId,
        requisitionId: params.requisitionId,
        weekStart: params.weekStart,
      },
      select: { id: true, status: true },
    })
  }

  // Read-only: si el día no existe todavía, no puede tener marcas — eso lo
  // resuelve el servicio sin necesidad de esta llamada.
  async findDay(timesheetId: string, workDate: Date): Promise<{ id: string } | null> {
    return this.prisma.timesheetDay.findFirst({
      where: { timesheetId, workDate },
      select: { id: true },
    })
  }

  async dayStatusExists(id: string): Promise<boolean> {
    return (
      (await this.prisma.timesheetDayStatus.findUnique({ where: { id }, select: { id: true } })) !==
      null
    )
  }

  /** Crea el día si no existe (como un ponche lo haría) y le pone el estado;
      `null` lo quita. */
  async setDayStatus(params: {
    timesheetId: string
    workDate: Date
    dayStatusId: string | null
  }): Promise<string> {
    const day = await this.prisma.timesheetDay.upsert({
      where: {
        timesheetId_workDate: { timesheetId: params.timesheetId, workDate: params.workDate },
      },
      update: { dayStatusId: params.dayStatusId },
      create: {
        id: uuidv7(),
        timesheetId: params.timesheetId,
        workDate: params.workDate,
        grossMinutes: 0,
        dayStatusId: params.dayStatusId,
      },
      select: { id: true },
    })

    return day.id
  }

  // La misma lógica de find-or-create que antes vivía en `ensureDay`, pero
  // corriendo DENTRO de la transacción del caller (addPunch/addManualPunch) en
  // vez de en la suya propia — así crear el día y registrar la marca son un
  // solo hecho: si algo después falla, Postgres deshace también la creación.
  private async ensureDayTx(
    tx: Prisma.TransactionClient,
    params: EnsureDayParams,
  ): Promise<{ timesheetId: string; dayId: string }> {
    let sheet = await tx.timesheet.findFirst({
      where: {
        workerId: params.workerId,
        requisitionId: params.requisitionId,
        weekStart: params.weekStart,
      },
      select: { id: true },
    })

    if (!sheet) {
      sheet = await tx.timesheet.create({
        data: {
          id: uuidv7(),
          scheduleId: params.scheduleId,
          workerId: params.workerId,
          requisitionId: params.requisitionId,
          weekStart: params.weekStart,
          weekEnd: params.weekEnd,
        },
        select: { id: true },
      })
    }

    let day = await tx.timesheetDay.findFirst({
      where: { timesheetId: sheet.id, workDate: params.workDate },
      select: { id: true },
    })

    if (!day) {
      day = await tx.timesheetDay.create({
        data: { id: uuidv7(), timesheetId: sheet.id, workDate: params.workDate, grossMinutes: 0 },
        select: { id: true },
      })
    }

    return { timesheetId: sheet.id, dayId: day.id }
  }

  async punchExists(dayId: string, type: string): Promise<boolean> {
    return (await this.prisma.punchMark.count({ where: { timesheetDayId: dayId, type } })) > 0
  }

  async punches(dayId: string): Promise<PunchRow[]> {
    return this.prisma.punchMark.findMany({
      where: { timesheetDayId: dayId },
      orderBy: { serverAt: 'asc' },
      select: {
        id: true,
        type: true,
        serverAt: true,
        deviceAt: true,
        insideGeofence: true,
        isManual: true,
        manualReason: true,
      },
    })
  }

  // Crea el timesheet/día si hacen falta E inserta la marca en la MISMA
  // transacción: si la marca no se puede insertar, la creación tampoco queda.
  async addPunch(params: {
    ensure: EnsureDayParams
    type: string
    latitude: number
    longitude: number
    insideGeofence: boolean | null
    photoPath: string | null
    qrVersion: number | null
    deviceAt: Date | null
    userId: string
    roleCode: string
  }): Promise<{ id: string; dayId: string }> {
    const id = uuidv7()

    const dayId = await this.prisma.$transaction(async (tx) => {
      const { dayId } = await this.ensureDayTx(tx, params.ensure)

      await tx.$executeRaw`
        INSERT INTO operations.punch_mark
          (id, timesheet_day_id, type, device_at, coordinates, inside_geofence, photo_path, qr_version)
        VALUES (
          ${id}::uuid,
          ${dayId}::uuid,
          ${params.type},
          ${params.deviceAt}::timestamptz,
          ST_SetSRID(ST_MakePoint(${params.longitude}::float8, ${params.latitude}::float8), 4326)::geography,
          ${params.insideGeofence},
          ${params.photoPath},
          ${params.qrVersion}
        )`

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'operations.punch_mark',
          entityId: id,
          eventType: 'PUNCH_REGISTERED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { type: params.type, insideGeofence: params.insideGeofence },
        },
      })

      return dayId
    })

    return { id, dayId }
  }

  // Mismo principio que addPunch: crear el día y registrar el manual son un
  // solo hecho.
  async addManualPunch(params: {
    ensure: EnsureDayParams
    type: string
    occurredAt: Date
    reason: string
    userId: string
    roleCode: string
  }): Promise<{ id: string; dayId: string }> {
    const id = uuidv7()

    const dayId = await this.prisma.$transaction(async (tx) => {
      const { dayId } = await this.ensureDayTx(tx, params.ensure)

      await tx.$executeRaw`
        INSERT INTO operations.punch_mark
          (id, timesheet_day_id, type, server_at, is_manual, registered_by, manual_reason)
        VALUES (
          ${id}::uuid,
          ${dayId}::uuid,
          ${params.type},
          ${params.occurredAt}::timestamptz,
          true,
          ${params.userId}::uuid,
          ${params.reason}
        )`

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'operations.punch_mark',
          entityId: id,
          eventType: 'PUNCH_REGISTERED_MANUALLY',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { type: params.type, reason: params.reason },
        },
      })

      return dayId
    })

    return { id, dayId }
  }

  /**
   * El lonche se recalcula en cada marca, junto con el bruto: no es un valor
   * fijo (Hugo, 2026-10-14). Con `hotel.pays_lunch`, nunca se resta nada —
   * las horas quedan completas. Sin él, se resta solo si el turno llega a
   * 6.5 h (390 min); menos que eso, el turno no alcanza a necesitar el
   * descanso y no se resta nada — antes eran 30 min fijos para cualquier
   * duración.
   */
  async recalcDay(
    dayId: string,
    grossMinutes: number,
    hasAnomaly: boolean,
    overnight: { continuesNextDay: boolean; continuesFromPreviousDay: boolean },
  ): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE operations.timesheet_day d
         SET gross_minutes = ${grossMinutes},
             has_anomaly = ${hasAnomaly},
             continues_next_day = ${overnight.continuesNextDay},
             continues_from_previous_day = ${overnight.continuesFromPreviousDay},
             lunch_deduction_minutes = CASE
               WHEN h.pays_lunch THEN 0
               WHEN ${grossMinutes}::int >= 390 THEN 30
               ELSE 0
             END
        FROM operations.timesheet t
        JOIN demand.requisition r ON r.id = t.requisition_id
        JOIN commercial.hotel h   ON h.id = r.hotel_id
       WHERE d.id = ${dayId}::uuid
         AND t.id = d.timesheet_id`
  }

  /** Lo mínimo para buscar el día ANTERIOR del mismo Timesheet al emparejar
      un turno nocturno (D-?? — ver el Prisma schema). */
  async dayForPairing(dayId: string): Promise<{ timesheetId: string; workDate: Date } | null> {
    return this.prisma.timesheetDay.findUnique({
      where: { id: dayId },
      select: { timesheetId: true, workDate: true },
    })
  }

  /** Lo que `correctPunch` necesita saber ANTES de tocar nada: a qué día,
      timesheet y departamento pertenece, si ese timesheet sigue editable, y
      la hora que tenía — para el "antes" del journal. */
  async punchContext(punchId: string): Promise<{
    dayId: string
    status: string
    departmentId: string | null
    hotelId: string
    type: string
    previousOccurredAt: Date
    workerId: string
  } | null> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        dayId: string
        status: string
        departmentId: string | null
        hotelId: string
        type: string
        previousOccurredAt: Date
        workerId: string
      }>
    >`
      SELECT pm.timesheet_day_id AS "dayId",
             pm.type,
             pm.server_at        AS "previousOccurredAt",
             t.status,
             t.worker_id         AS "workerId",
             r.hotel_id          AS "hotelId",
             (SELECT p.hotel_department_id
                FROM demand."position" p
               WHERE p.requisition_id = t.requisition_id
               LIMIT 1) AS "departmentId"
        FROM operations.punch_mark pm
        JOIN operations.timesheet_day td ON td.id = pm.timesheet_day_id
        JOIN operations.timesheet t      ON t.id = td.timesheet_id
        JOIN demand.requisition r        ON r.id = t.requisition_id
       WHERE pm.id = ${punchId}::uuid`

    return rows[0] ?? null
  }

  /** La marca YA existe (a diferencia de `addManualPunch`, que la crea):
      corregir es un UPDATE, no otro INSERT — el día solo admite una marca
      por tipo (`ux_punch_day_type`), así que una segunda fila del mismo
      tipo chocaría con esa restricción en vez de corregir nada. Queda
      marcada como manual: una vez que una persona reescribió la hora, ya
      no es honesto seguir presentándola como lo que reportó el reloj. */
  async correctPunch(params: {
    punchId: string
    type: string
    occurredAt: Date
    reason: string
    previousOccurredAt: Date
    userId: string
    roleCode: string
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.punchMark.update({
        where: { id: params.punchId },
        data: {
          serverAt: params.occurredAt,
          isManual: true,
          registeredBy: params.userId,
          manualReason: params.reason,
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'operations.punch_mark',
          entityId: params.punchId,
          eventType: 'PUNCH_CORRECTED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: {
            type: params.type,
            previousOccurredAt: params.previousOccurredAt.toISOString(),
            occurredAt: params.occurredAt.toISOString(),
            reason: params.reason,
          },
        },
      })
    })
  }

  async days(timesheetId: string): Promise<DayRow[]> {
    const rows = await this.prisma.$queryRaw<
      Array<
        Omit<DayRow, 'dayStatus'> & { dayStatusCode: string | null; dayStatusName: string | null }
      >
    >`
      SELECT v.id,
             v.work_date                 AS "workDate",
             v.gross_minutes             AS "grossMinutes",
             v.lunch_deduction_minutes   AS "lunchDeductionMinutes",
             v.overtime_minutes          AS "overtimeMinutes",
             v.net_minutes               AS "netMinutes",
             v.actual_lunch_minutes      AS "actualLunchMinutes",
             v.is_absence                AS "isAbsence",
             v.has_anomaly               AS "hasAnomaly",
             v.continues_next_day          AS "continuesNextDay",
             v.continues_from_previous_day AS "continuesFromPreviousDay",
             v.review_note               AS "reviewNote",
             ds.code                     AS "dayStatusCode",
             ds.name                     AS "dayStatusName"
        FROM operations.vw_timesheet_day v
        LEFT JOIN catalogs.timesheet_day_status ds ON ds.id = v.day_status_id
       WHERE v.timesheet_id = ${timesheetId}::uuid
       ORDER BY v.work_date`

    return rows.map(({ dayStatusCode, dayStatusName, ...rest }) => ({
      ...rest,
      dayStatus:
        dayStatusCode && dayStatusName ? { code: dayStatusCode, name: dayStatusName } : null,
    }))
  }

  async timesheet(
    id: string,
  ): Promise<(TimesheetRow & { departmentId: string | null; hotelId: string }) | null> {
    const rows = await this.prisma.$queryRaw<
      Array<TimesheetRow & { departmentId: string | null; hotelId: string; workerName: string }>
    >`
      SELECT t.id,
             t.week_start AS "weekStart",
             t.week_end   AS "weekEnd",
             t.status,
             t.approved_at AS "approvedAt",
             t.requisition_id AS "requisitionId",
             r.hotel_id       AS "hotelId",
             w.full_name      AS "workerName",
             jsonb_build_object('id', w.id, 'fullName', w.full_name) AS worker,
             ${ASSIGNMENT_OF_TIMESHEET},
             ${APPROVED_BY_OF_TIMESHEET},
             (SELECT p.hotel_department_id
                FROM demand."position" p
               WHERE p.requisition_id = t.requisition_id
               LIMIT 1) AS "departmentId"
        FROM operations.timesheet t
        JOIN personal.worker w    ON w.id = t.worker_id
        JOIN demand.requisition r ON r.id = t.requisition_id
       WHERE t.id = ${id}::uuid`

    return rows[0] ?? null
  }

  async listOfWorker(workerId: string): Promise<TimesheetRow[]> {
    return this.prisma.$queryRaw<TimesheetRow[]>`
      SELECT t.id,
             t.week_start AS "weekStart",
             t.week_end   AS "weekEnd",
             t.status,
             t.approved_at AS "approvedAt",
             t.requisition_id AS "requisitionId",
             jsonb_build_object('id', w.id, 'fullName', w.full_name) AS worker,
             ${ASSIGNMENT_OF_TIMESHEET},
             ${APPROVED_BY_OF_TIMESHEET}
        FROM operations.timesheet t
        JOIN personal.worker w ON w.id = t.worker_id
       WHERE t.worker_id = ${workerId}::uuid
       ORDER BY t.week_start DESC
       LIMIT 52`
  }

  /**
   * El periodo se filtra AQUÍ y no en el navegador (Hugo, 2026-10-05).
   *
   * El front sabía recortar por fechas, pero pedía todas las semanas y
   * recortaba después: el tope de `limit` seguía mordiendo antes, y cuando
   * muerde la pantalla enseña lo que quepa **sin decir que cortó** — el mismo
   * defecto del contador del Pool que decía 100 con 307 en la base. Con el
   * rango en la consulta, lo que se pide ya viene acotado y el tope deja de
   * poder alcanzarse por el simple paso del tiempo.
   *
   * El criterio es el mismo que el del front: una semana entra si **toca** el
   * periodo, no si cabe entera — quien pide «del 1 al 20» espera ver la
   * semana que empieza el 29 y termina el 4.
   */
  async listAll(params: {
    /** Alcance del permiso: el hotel de quien pregunta, o `null` = todos. */
    scopeHotelId: string | null
    /** Filtro de la pantalla. Se suma al alcance; nunca lo amplía. */
    hotelId: string | null
    weekStart: string | null
    departmentId: string | null
    status?: string | undefined
    /** `AAAA-MM-DD`; `null` = sin acotar por ese extremo. */
    from?: string | null
    to?: string | null
    limit: number
    /** Una hoja puntual, sin importar hotel/semana/estado (la usa `one()` tras corregir). */
    timesheetId?: string | undefined
  }): Promise<TimesheetListRow[]> {
    return this.prisma.$queryRaw<TimesheetListRow[]>`
      SELECT t.id,
             t.week_start AS "weekStart",
             t.week_end   AS "weekEnd",
             t.status,
             t.approved_at AS "approvedAt",
             t.requisition_id AS "requisitionId",
             r.number     AS "requisitionFolio",
             jsonb_build_object('id', h.id, 'name', h.name) AS hotel,
             jsonb_build_object('id', w.id, 'fullName', w.full_name) AS worker,
             ${ASSIGNMENT_OF_TIMESHEET},
             ${APPROVED_BY_OF_TIMESHEET}
        FROM operations.timesheet t
        JOIN personal.worker w    ON w.id = t.worker_id
        JOIN demand.requisition r ON r.id = t.requisition_id
        JOIN commercial.hotel h   ON h.id = r.hotel_id
       WHERE (${params.scopeHotelId}::uuid IS NULL OR r.hotel_id = ${params.scopeHotelId}::uuid)
         AND (${params.hotelId}::uuid IS NULL OR r.hotel_id = ${params.hotelId}::uuid)
         AND (${params.weekStart}::date IS NULL OR t.week_start = ${params.weekStart}::date)
         AND (${params.status}::text IS NULL OR t.status = ${params.status}::text)
         AND (${params.timesheetId ?? null}::uuid IS NULL OR t.id = ${params.timesheetId ?? null}::uuid)
         AND (${params.from ?? null}::date IS NULL OR t.week_end   >= ${params.from ?? null}::date)
         AND (${params.to ?? null}::date   IS NULL OR t.week_start <= ${params.to ?? null}::date)
         AND (${params.departmentId}::uuid IS NULL OR EXISTS (
               SELECT 1 FROM demand."position" p
                WHERE p.requisition_id = t.requisition_id
                  AND p.hotel_department_id = ${params.departmentId}::uuid))
       -- t.id desempata: sin un segundo criterio, filas con el mismo week_start
       -- pueden quedar en cualquier lado del LIMIT de una corrida a otra — el
       -- mismo recorte, pero ya no al azar.
       ORDER BY t.week_start DESC, t.id DESC
       LIMIT ${params.limit}`
  }

  /**
   * Vista previa de pago para un lote de hojas, calculada en vivo — nada se
   * guarda ni se modifica aquí. Replica la misma cascada de tarifa, el mismo
   * corte de 40 h por requisición y los mismos ajustes/gastos YA incluidos
   * que PaymentRunsRepository.generate (la misma cifra, 2400, vive también
   * ahí: ver su comentario sobre D-10) — para que la vista previa de
   * Contabilidad y el consolidado final nunca se contradigan. Los
   * aprobados-sin-incluir (Hugo, 2026-10-14: "sea opcional sumarlo") se
   * resuelven aparte, con `GET /pay-adjustments/approved-pending-inclusion`
   * (la misma cola que ya usa «Ajustes a incluir»): no se duplica la lógica
   * de emparejar asignación↔semana en dos lugares.
   */
  async payPreview(timesheetIds: string[]): Promise<TimesheetPayPreview[]> {
    if (timesheetIds.length === 0) return []

    return this.prisma.$queryRaw<TimesheetPayPreview[]>`
      WITH horas AS (
        SELECT t.id AS timesheet_id,
               t.worker_id,
               t.requisition_id,
               t.week_start,
               t.week_end,
               r.hotel_id,
               pos.catalog_position_id,
               coalesce(sum(v.net_minutes), 0)::int AS total_minutes
          FROM operations.timesheet t
          JOIN demand.requisition r ON r.id = t.requisition_id
          LEFT JOIN operations.timesheet_day d        ON d.timesheet_id = t.id
          LEFT JOIN operations.vw_timesheet_day v      ON v.id = d.id
          JOIN LATERAL (
            SELECT p.catalog_position_id
              FROM demand."position" p
             WHERE p.requisition_id = t.requisition_id
               AND p.deleted_at IS NULL
             ORDER BY EXISTS (
                        SELECT 1
                          FROM coverage.assignment a
                          JOIN demand.slot s ON s.id = a.slot_id
                         WHERE s.position_id = p.id
                           AND a.worker_id = t.worker_id
                      ) DESC,
                      p.line_number
             LIMIT 1
          ) pos ON true
         WHERE t.id = ANY(${timesheetIds}::uuid[])
         GROUP BY t.id, t.worker_id, t.requisition_id, t.week_start, t.week_end,
                  r.hotel_id, pos.catalog_position_id
      ),
      -- La asignación EVENTUAL de esta persona en esta posición, vigente en
      -- la semana de la hoja: mismo criterio que PaymentRunsRepository, no
      -- se adivina aparte (Hugo, 2026-10-09: "una eventual que cambia de
      -- tramo no debe heredar el ajuste de un tramo distinto").
      ajuste_asignacion AS (
        SELECT h.timesheet_id,
               (SELECT a.id
                  FROM coverage.assignment a
                  JOIN demand.slot s       ON s.id = a.slot_id
                  JOIN demand."position" p ON p.id = s.position_id
                 WHERE a.worker_id = h.worker_id
                   AND p.requisition_id = h.requisition_id
                   AND a.type = 'TEMPORARY'
                   AND a.validity && daterange(h.week_start, h.week_end, '[]')
                 ORDER BY a.validity DESC
                 LIMIT 1) AS assignment_id
          FROM horas h
      ),
      ajuste_tarifa AS (
        SELECT DISTINCT ON (aa.timesheet_id)
               aa.timesheet_id, pa.amount AS adj_rate
          FROM ajuste_asignacion aa
          JOIN coverage.assignment_pay_adjustment pa
            ON pa.assignment_id = aa.assignment_id
           AND pa.pay_concept_id IS NULL
           AND pa.status = 'APPROVED'
           AND pa.included_at IS NOT NULL
           AND pa.applied_at IS NULL
         ORDER BY aa.timesheet_id, pa.included_at DESC
      ),
      ajuste_reembolso AS (
        SELECT aa.timesheet_id, COALESCE(sum(pa.amount), 0) AS adj_reimburse
          FROM ajuste_asignacion aa
          JOIN coverage.assignment_pay_adjustment pa
            ON pa.assignment_id = aa.assignment_id
           AND pa.pay_concept_id IS NOT NULL
           AND pa.settlement_effect = 'REIMBURSE'
           AND pa.status = 'APPROVED'
           AND pa.included_at IS NOT NULL
           AND pa.applied_at IS NULL
         GROUP BY aa.timesheet_id
      ),
      ajuste_descuento AS (
        SELECT aa.timesheet_id, COALESCE(sum(pa.amount), 0) AS adj_deduction
          FROM ajuste_asignacion aa
          JOIN coverage.assignment_pay_adjustment pa
            ON pa.assignment_id = aa.assignment_id
           AND pa.settlement_effect = 'PAYROLL_DEDUCTION'
           AND pa.status = 'APPROVED'
           AND pa.included_at IS NOT NULL
           AND pa.applied_at IS NULL
         GROUP BY aa.timesheet_id
      ),
      tarifas AS (
        SELECT h.*,
               LEAST(h.total_minutes, 2400)::int        AS computed_regular_minutes,
               GREATEST(h.total_minutes - 2400, 0)::int AS computed_overtime_minutes,
               COALESCE(at.adj_rate, wr.rate, cr.pay_rate) AS computed_pay_rate,
               (at.adj_rate IS NULL AND wr.rate IS NOT NULL) AS is_internal,
               -- SIEMPRE del contrato: no hay "bill rate interno" como sí lo
               -- hay del lado del pago — es lo que el hotel paga a Oranje.
               cr.bill_rate AS bill_rate,
               COALESCE(ct.overtime_pay_multiplier, hot.overtime_pay_multiplier, 0) AS ot_multiplier,
               ct.updated_at AS contract_updated_at,
               ar.adj_reimburse,
               ad.adj_deduction,
               ov.regular_minutes  AS override_regular_minutes,
               ov.overtime_minutes AS override_overtime_minutes,
               ov.pay_rate         AS override_pay_rate,
               ov.reason           AS override_reason
          FROM horas h
          LEFT JOIN ajuste_tarifa at    ON at.timesheet_id = h.timesheet_id
          LEFT JOIN ajuste_reembolso ar ON ar.timesheet_id = h.timesheet_id
          LEFT JOIN ajuste_descuento ad ON ad.timesheet_id = h.timesheet_id
          LEFT JOIN personal.worker_rate wr
                 ON wr.worker_id = h.worker_id
                AND wr.valid_to IS NULL
                AND wr.pay_concept_id IS NULL
                AND (wr.catalog_position_id = h.catalog_position_id
                     OR wr.catalog_position_id IS NULL)
          LEFT JOIN commercial.contract ct
                 ON ct.hotel_id = h.hotel_id AND ct.status = 'ACTIVE'
          LEFT JOIN commercial.contract_rate cr
                 ON cr.contract_id = ct.id
                AND cr.catalog_position_id = h.catalog_position_id
          LEFT JOIN commercial.hotel hot
                 ON hot.id = h.hotel_id
          -- La corrección de Contabilidad (Hugo, 2026-10-08) pisa tarifa y
          -- reparto de horas; el multiplicador sigue siendo el del hotel.
          LEFT JOIN settlement.timesheet_pay_override ov
                 ON ov.timesheet_id = h.timesheet_id
      ),
      efectivo AS (
        SELECT timesheet_id,
               COALESCE(override_regular_minutes, computed_regular_minutes)   AS regular_minutes,
               COALESCE(override_overtime_minutes, computed_overtime_minutes) AS overtime_minutes,
               COALESCE(override_pay_rate, computed_pay_rate)                 AS pay_rate,
               is_internal,
               bill_rate,
               ot_multiplier,
               contract_updated_at,
               adj_reimburse,
               adj_deduction,
               (override_pay_rate IS NOT NULL) AS is_overridden,
               override_reason
          FROM tarifas
      )
      SELECT e.timesheet_id   AS "timesheetId",
             regular_minutes  AS "regularMinutes",
             overtime_minutes AS "overtimeMinutes",
             pay_rate::text   AS "payRate",
             is_internal      AS "isInternalRate",
             CASE WHEN pay_rate IS NULL THEN NULL ELSE ot_multiplier::float END AS "overtimeMultiplier",
             CASE WHEN pay_rate IS NULL THEN NULL
                  ELSE round((regular_minutes / 60.0) * pay_rate
                           + (overtime_minutes / 60.0) * pay_rate * ot_multiplier
                           + COALESCE(adj_reimburse, 0), 2)::text
             END AS subtotal,
             COALESCE(adj_deduction, 0)::text AS "deductionAmount",
             CASE WHEN pay_rate IS NULL THEN NULL
                  ELSE round((regular_minutes / 60.0) * pay_rate
                           + (overtime_minutes / 60.0) * pay_rate * ot_multiplier
                           + COALESCE(adj_reimburse, 0) - COALESCE(adj_deduction, 0), 2)::text
             END AS "netAmount",
             is_overridden    AS "isOverridden",
             override_reason  AS "overrideReason",
             bill_rate::text  AS "billRate",
             CASE WHEN bill_rate IS NULL THEN NULL
                  ELSE round((regular_minutes / 60.0) * bill_rate
                           + (overtime_minutes / 60.0) * bill_rate * ot_multiplier, 2)::text
             END AS "billSubtotal",
             contract_updated_at AS "contractUpdatedAt"
        FROM efectivo e`
  }

  /**
   * Corrección de Contabilidad sobre la vista previa (Hugo, 2026-10-08): una
   * sola vigente por hoja, se reescribe la misma fila. El subtotal se calcula
   * aquí con el multiplicador YA resuelto, solo para mostrarlo — la corrida
   * real (`PaymentRunsRepository`) lo vuelve a calcular con el multiplicador
   * vigente al momento de pagar, nunca confía en este valor guardado.
   */
  async setPayOverride(params: {
    timesheetId: string
    regularMinutes: number
    overtimeMinutes: number
    payRate: number
    reason: string
    userId: string
  }): Promise<void> {
    await this.prisma.$executeRaw`
      WITH mult AS (
        SELECT COALESCE(ct.overtime_pay_multiplier, hot.overtime_pay_multiplier, 0) AS ot_multiplier
          FROM operations.timesheet t
          JOIN demand.requisition r ON r.id = t.requisition_id
          LEFT JOIN commercial.contract ct ON ct.hotel_id = r.hotel_id AND ct.status = 'ACTIVE'
          LEFT JOIN commercial.hotel hot   ON hot.id = r.hotel_id
         WHERE t.id = ${params.timesheetId}::uuid
      )
      INSERT INTO settlement.timesheet_pay_override
        (id, timesheet_id, regular_minutes, overtime_minutes, pay_rate, subtotal, reason, created_by)
      SELECT gen_random_uuid(), ${params.timesheetId}::uuid,
             ${params.regularMinutes}, ${params.overtimeMinutes}, ${params.payRate}::numeric,
             round((${params.regularMinutes}::numeric / 60) * ${params.payRate}::numeric
                 + (${params.overtimeMinutes}::numeric / 60) * ${params.payRate}::numeric * mult.ot_multiplier, 2),
             ${params.reason}, ${params.userId}::uuid
        FROM mult
      ON CONFLICT (timesheet_id) DO UPDATE
        SET regular_minutes  = EXCLUDED.regular_minutes,
            overtime_minutes = EXCLUDED.overtime_minutes,
            pay_rate         = EXCLUDED.pay_rate,
            subtotal         = EXCLUDED.subtotal,
            reason           = EXCLUDED.reason,
            updated_by       = EXCLUDED.created_by,
            updated_at       = now()`
  }

  /** Vuelve a lo calculado: borra la corrección, no la deja en cero. */
  async deletePayOverride(timesheetId: string): Promise<void> {
    await this.prisma.$executeRaw`
      DELETE FROM settlement.timesheet_pay_override WHERE timesheet_id = ${timesheetId}::uuid`
  }

  async setStatus(params: {
    id: string
    status: string
    approvedBy: string | null
    userId: string
    roleCode: string
    event: string
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.timesheet.update({
        where: { id: params.id },
        data: {
          status: params.status,
          approvedBy: params.approvedBy,
          approvedAt: params.approvedBy ? new Date() : null,
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'operations.timesheet',
          entityId: params.id,
          eventType: params.event,
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { status: params.status },
        },
      })
    })
  }

  async reviewDay(params: {
    dayId: string
    note: string
    userId: string
    roleCode: string
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.timesheetDay.update({
        where: { id: params.dayId },
        data: {
          hasAnomaly: false,
          reviewNote: params.note,
          reviewedBy: params.userId,
          reviewedAt: new Date(),
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'operations.timesheet_day',
          entityId: params.dayId,
          eventType: 'DAY_REVIEWED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { note: params.note },
        },
      })
    })
  }

  async dayById(id: string): Promise<{ id: string; timesheetId: string; status: string } | null> {
    const row = await this.prisma.timesheetDay.findUnique({
      where: { id },
      select: { id: true, timesheetId: true, timesheet: { select: { status: true } } },
    })

    return row ? { id: row.id, timesheetId: row.timesheetId, status: row.timesheet.status } : null
  }
  /**
   * Los turnos planeados de días que YA CERRARON y a los que nadie ponchó.
   *
   * Cada fila es una inasistencia candidata. «Ya cerró» se mide en la zona del
   * hotel y no en UTC: el día no termina a la misma hora en Georgia que en
   * Cancún, y contar en UTC marcaría faltas de días que todavía no acaban —el
   * mismo error que costó la ronda de fechas de septiembre—.
   *
   * No cuenta a quien está protegido: en Gris el vault dice que las
   * inasistencias NO cuentan, y en Rosa el hotel mismo lo mandó a descansar.
   * Negro ya está vetado y Morado ya tiene su falta de ese día.
   */
  async closedShiftsWithoutPunch(limit: number): Promise<
    Array<{
      assignmentId: string
      workerId: string
      requisitionId: string
      hotelId: string
      scheduleId: string
      weekStart: Date
      weekEnd: Date
      workDate: Date
    }>
  > {
    return this.prisma.$queryRaw`
      SELECT a.id::text        AS "assignmentId",
             a.worker_id::text AS "workerId",
             r.id::text        AS "requisitionId",
             h.id::text        AS "hotelId",
             sc.id::text       AS "scheduleId",
             sc.week_start     AS "weekStart",
             sc.week_end       AS "weekEnd",
             e.work_date       AS "workDate"
        FROM operations.schedule_entry e
        JOIN operations.schedule sc ON sc.id = e.schedule_id
        JOIN commercial.hotel h     ON h.id = sc.hotel_id
        JOIN coverage.assignment a  ON a.id = e.assignment_id
        JOIN demand.slot sl         ON sl.id = a.slot_id
        JOIN demand.position p      ON p.id = sl.position_id
        JOIN demand.requisition r   ON r.id = p.requisition_id
        JOIN personal.worker w      ON w.id = a.worker_id
        JOIN catalogs.status_light_state st
          ON st.id = w.status_light_state_id AND st.status_light_code = 'WORKER'
       WHERE e.work_date < (now() AT TIME ZONE h.time_zone)::date
         AND w.deleted_at IS NULL
         AND st.code NOT IN ('GRAY', 'PINK', 'BLACK', 'PURPLE')
         AND NOT EXISTS (
               SELECT 1
                 FROM operations.timesheet t
                 JOIN operations.timesheet_day d ON d.timesheet_id = t.id
                WHERE t.worker_id = a.worker_id
                  AND t.requisition_id = r.id
                  AND d.work_date = e.work_date
                  AND (d.is_absence OR EXISTS (
                        SELECT 1 FROM operations.punch_mark pm
                         WHERE pm.timesheet_day_id = d.id)))
       ORDER BY e.work_date
       LIMIT ${limit}`
  }

  /** De qué estado venía antes de caer en Morado, para devolverlo ahí. */
  async stateBeforePurple(workerId: string, purpleStateId: string): Promise<{ id: string } | null> {
    const row = await this.prisma.workerStateHistory.findFirst({
      where: { workerId, toStateId: purpleStateId },
      orderBy: { occurredAt: 'desc' },
      select: { fromStateId: true },
    })
    return row?.fromStateId ? { id: row.fromStateId } : null
  }

  /** Cuántas inasistencias lleva acumuladas, de todas sus requisiciones. */
  async absenceCount(workerId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n
        FROM operations.timesheet t
        JOIN operations.timesheet_day d ON d.timesheet_id = t.id
       WHERE t.worker_id = ${workerId}::uuid AND d.is_absence`
    return rows[0]?.n ?? 0
  }

  /** Marca el día como falta, creándolo si nadie lo había abierto. */
  async markAbsence(params: EnsureDayParams): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const { dayId } = await this.ensureDayTx(tx, params)
      await tx.timesheetDay.update({
        where: { id: dayId },
        data: { isAbsence: true, updatedAt: new Date() },
      })
      return dayId
    })
  }

  /**
   * Cuántos días DISTINTOS lleva ponchados en esta asignación.
   *
   * El timesheet se guarda por semana y requisición, no por asignación, así
   * que se cuenta por colaborador + requisición. Un día cuenta cuando tiene
   * al menos una marca: lo que el vault llama «asistir» es haber ponchado.
   */
  async workedDays(workerId: string, requisitionId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ n: number }>>`
      SELECT count(DISTINCT d.work_date)::int AS n
        FROM operations.timesheet t
        JOIN operations.timesheet_day d ON d.timesheet_id = t.id
       WHERE t.worker_id = ${workerId}::uuid
         AND t.requisition_id = ${requisitionId}::uuid
         AND EXISTS (SELECT 1 FROM operations.punch_mark p WHERE p.timesheet_day_id = d.id)`
    return rows[0]?.n ?? 0
  }

  /** En qué estado del semáforo está hoy, con el id del estado. */
  async workerState(workerId: string): Promise<{ stateId: string; code: string } | null> {
    const row = await this.prisma.worker.findUnique({
      where: { id: workerId },
      select: { statusLightStateId: true, statusState: { select: { code: true } } },
    })
    return row ? { stateId: row.statusLightStateId, code: row.statusState.code } : null
  }

  async workerStateByCode(code: string): Promise<{ id: string } | null> {
    return this.prisma.statusLightState.findFirst({
      where: { code, statusLightCode: 'WORKER' },
      select: { id: true },
    })
  }

  /**
   * Avanza el semáforo del colaborador y lo deja en la historia.
   *
   * `fromStateId` va en el `where` a propósito: si entre que se leyó el estado
   * y se escribe alguien lo movió —a Gris por un accidente, a Negro por la
   * Blacklist— esta escritura no encuentra fila y no pisa nada. Devuelve si
   * de verdad avanzó.
   */
  async advanceWorkerState(params: {
    workerId: string
    fromStateId: string
    toStateId: string
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.worker.updateMany({
        where: { id: params.workerId, statusLightStateId: params.fromStateId },
        data: { statusLightStateId: params.toStateId, updatedAt: new Date() },
      })

      if (count === 0) return false

      await tx.workerStateHistory.create({
        data: {
          id: uuidv7(),
          workerId: params.workerId,
          fromStateId: params.fromStateId,
          toStateId: params.toStateId,
          statusLightCode: 'WORKER',
          /* Sin persona: lo movió el sistema al contar los días ponchados.
             La columna es nulable justo para esto. */
          userId: null,
        },
      })
      return true
    })
  }
}
