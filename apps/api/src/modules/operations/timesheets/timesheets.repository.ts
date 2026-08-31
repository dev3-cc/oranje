import { Injectable } from '@nestjs/common'
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
}

@Injectable()
export class TimesheetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // La cuenta de un colaborador puede no existir: en Fase 1 todavia no la tiene.
  async workerOfUser(userId: string): Promise<string | null> {
    const row = await this.prisma.worker.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    })

    return row?.id ?? null
  }

  // El turno de HOY de un colaborador, con la fecha LOCAL DEL HOTEL: a las
  // 23:00 en Cancun ya es el dia siguiente en UTC, y el turno se buscaria mal.
  //
  // Devuelve todos los del dia y no el primero: RR-05 impide dos turnos que se
  // encimen por horas, pero no dos en el mismo dia — quien decide que hacer con
  // eso es el servicio.
  async shiftsToday(workerId: string): Promise<Array<{ assignmentId: string }>> {
    return this.prisma.$queryRaw<Array<{ assignmentId: string }>>`
      SELECT e.assignment_id AS "assignmentId"
        FROM operations.schedule_entry e
        JOIN coverage.assignment a  ON a.id = e.assignment_id
        JOIN demand.slot s          ON s.id = a.slot_id
        JOIN demand."position" p    ON p.id = s.position_id
        JOIN demand.requisition r   ON r.id = p.requisition_id
        JOIN commercial.hotel h     ON h.id = r.hotel_id
       WHERE e.worker_id = ${workerId}::uuid
         AND e.work_date = (now() AT TIME ZONE h.time_zone)::date
       ORDER BY lower(e.shift_range)`
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
             (h.coordinates IS NOT NULL) AS "hasCoordinates"
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

  async ensureDay(params: {
    scheduleId: string
    workerId: string
    requisitionId: string
    weekStart: Date
    weekEnd: Date
    workDate: Date
  }): Promise<{ timesheetId: string; dayId: string; status: string }> {
    return this.prisma.$transaction(async (tx) => {
      let sheet = await tx.timesheet.findFirst({
        where: {
          workerId: params.workerId,
          requisitionId: params.requisitionId,
          weekStart: params.weekStart,
        },
        select: { id: true, status: true },
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
          select: { id: true, status: true },
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

      return { timesheetId: sheet.id, dayId: day.id, status: sheet.status }
    })
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

  async addPunch(params: {
    dayId: string
    type: string
    latitude: number
    longitude: number
    insideGeofence: boolean | null
    photoPath: string | null
    deviceAt: Date | null
    userId: string
    roleCode: string
  }): Promise<string> {
    const id = uuidv7()

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO operations.punch_mark
          (id, timesheet_day_id, type, device_at, coordinates, inside_geofence, photo_path)
        VALUES (
          ${id}::uuid,
          ${params.dayId}::uuid,
          ${params.type},
          ${params.deviceAt}::timestamptz,
          ST_SetSRID(ST_MakePoint(${params.longitude}::float8, ${params.latitude}::float8), 4326)::geography,
          ${params.insideGeofence},
          ${params.photoPath}
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
    })

    return id
  }

  async addManualPunch(params: {
    dayId: string
    type: string
    occurredAt: Date
    reason: string
    userId: string
    roleCode: string
  }): Promise<string> {
    const id = uuidv7()

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO operations.punch_mark
          (id, timesheet_day_id, type, server_at, is_manual, registered_by, manual_reason)
        VALUES (
          ${id}::uuid,
          ${params.dayId}::uuid,
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
    })

    return id
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
             jsonb_build_object('id', w.id, 'fullName', w.full_name) AS worker
        FROM operations.timesheet t
        JOIN personal.worker w ON w.id = t.worker_id
       WHERE t.worker_id = ${workerId}::uuid
       ORDER BY t.week_start DESC
       LIMIT 52`
  }

  async listAll(params: {
    hotelId: string | null
    departmentId: string | null
    status?: string | undefined
  }): Promise<TimesheetRow[]> {
    return this.prisma.$queryRaw<TimesheetRow[]>`
      SELECT t.id,
             t.week_start AS "weekStart",
             t.week_end   AS "weekEnd",
             t.status,
             t.approved_at AS "approvedAt",
             t.requisition_id AS "requisitionId",
             jsonb_build_object('id', w.id, 'fullName', w.full_name) AS worker
        FROM operations.timesheet t
        JOIN personal.worker w    ON w.id = t.worker_id
        JOIN demand.requisition r ON r.id = t.requisition_id
       WHERE (${params.hotelId}::uuid IS NULL OR r.hotel_id = ${params.hotelId}::uuid)
         AND (${params.status}::text IS NULL OR t.status = ${params.status}::text)
         AND (${params.departmentId}::uuid IS NULL OR EXISTS (
               SELECT 1 FROM demand."position" p
                WHERE p.requisition_id = t.requisition_id
                  AND p.hotel_department_id = ${params.departmentId}::uuid))
       ORDER BY t.week_start DESC
       LIMIT 100`
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
}
