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
  reviewNote: string | null
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
  worker: { id: string; fullName: string }
  requisitionId: string
  /** La asignación que respalda al timesheet (ver `ASSIGNMENT_OF_TIMESHEET`). */
  assignment: { status: string; endsOn: string | null } | null
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

  async scheduleOf(
    hotelId: string,
    workDate: Date,
  ): Promise<{ id: string; weekStart: Date; weekEnd: Date } | null> {
    const day = workDate.toISOString().slice(0, 10)

    const rows = await this.prisma.$queryRaw<Array<{ id: string; weekStart: Date; weekEnd: Date }>>`
      SELECT id, week_start AS "weekStart", week_end AS "weekEnd"
        FROM operations.schedule
       WHERE hotel_id = ${hotelId}::uuid
         AND ${day}::date BETWEEN week_start AND week_end
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

  async recalcDay(dayId: string, grossMinutes: number, hasAnomaly: boolean): Promise<void> {
    await this.prisma.timesheetDay.update({
      where: { id: dayId },
      data: { grossMinutes, hasAnomaly },
    })
  }

  async days(timesheetId: string): Promise<DayRow[]> {
    return this.prisma.$queryRaw<DayRow[]>`
      SELECT id,
             work_date                 AS "workDate",
             gross_minutes             AS "grossMinutes",
             lunch_deduction_minutes   AS "lunchDeductionMinutes",
             overtime_minutes          AS "overtimeMinutes",
             net_minutes               AS "netMinutes",
             actual_lunch_minutes      AS "actualLunchMinutes",
             is_absence                AS "isAbsence",
             has_anomaly               AS "hasAnomaly",
             review_note               AS "reviewNote"
        FROM operations.vw_timesheet_day
       WHERE timesheet_id = ${timesheetId}::uuid
       ORDER BY work_date`
  }

  async timesheet(id: string): Promise<(TimesheetRow & { departmentId: string | null }) | null> {
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
             ${ASSIGNMENT_OF_TIMESHEET}
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
    hotelId: string | null
    departmentId: string | null
    status?: string | undefined
    /** `AAAA-MM-DD`; `null` = sin acotar por ese extremo. */
    from?: string | null
    to?: string | null
    limit: number
  }): Promise<TimesheetRow[]> {
    return this.prisma.$queryRaw<TimesheetRow[]>`
      SELECT t.id,
             t.week_start AS "weekStart",
             t.week_end   AS "weekEnd",
             t.status,
             t.approved_at AS "approvedAt",
             t.requisition_id AS "requisitionId",
             jsonb_build_object('id', w.id, 'fullName', w.full_name) AS worker,
             ${ASSIGNMENT_OF_TIMESHEET}
        FROM operations.timesheet t
        JOIN personal.worker w    ON w.id = t.worker_id
        JOIN demand.requisition r ON r.id = t.requisition_id
       WHERE (${params.hotelId}::uuid IS NULL OR r.hotel_id = ${params.hotelId}::uuid)
         AND (${params.status}::text IS NULL OR t.status = ${params.status}::text)
         AND (${params.from ?? null}::date IS NULL OR t.week_end   >= ${params.from ?? null}::date)
         AND (${params.to ?? null}::date   IS NULL OR t.week_start <= ${params.to ?? null}::date)
         AND (${params.departmentId}::uuid IS NULL OR EXISTS (
               SELECT 1 FROM demand."position" p
                WHERE p.requisition_id = t.requisition_id
                  AND p.hotel_department_id = ${params.departmentId}::uuid))
       ORDER BY t.week_start DESC
       LIMIT ${params.limit}`
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
