import { Injectable } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

export interface ScheduleRow {
  id: string
  weekStart: Date
  weekEnd: Date
  createdAt: Date
  hotel: { id: string; name: string; timeZone: string }
  _count: { entries: number }
}

export interface EntryRow {
  id: string
  workDate: Date
  startsAt: Date
  endsAt: Date
  worker: { id: string; fullName: string }
  assignmentId: string
}

const SELECT = {
  id: true,
  weekStart: true,
  weekEnd: true,
  createdAt: true,
  hotel: { select: { id: true, name: true, timeZone: true } },
  _count: { select: { entries: true } },
} as const

@Injectable()
export class SchedulesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async workerOfUser(userId: string): Promise<string | null> {
    const row = await this.prisma.worker.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    })

    return row?.id ?? null
  }

  // shift_range es un tstzrange, que Prisma no sabe leer: va en SQL.
  async entriesOfWorker(
    workerId: string,
    from: Date,
    to: Date,
  ): Promise<
    Array<{
      id: string
      assignmentId: string
      workDate: Date
      startsAt: Date
      endsAt: Date
      hotelName: string
      hotelPhotoRef: string | null
      hotelTimeZone: string
      positionName: string
    }>
  > {
    return this.prisma.$queryRaw`
      SELECT e.id,
             e.assignment_id           AS "assignmentId",
             e.work_date               AS "workDate",
             lower(e.shift_range)      AS "startsAt",
             upper(e.shift_range)      AS "endsAt",
             h.name                    AS "hotelName",
             h.photo_ref               AS "hotelPhotoRef",
             h.time_zone               AS "hotelTimeZone",
             cp.name                   AS "positionName"
        FROM operations.schedule_entry e
        JOIN coverage.assignment a  ON a.id = e.assignment_id
        JOIN demand.slot s          ON s.id = a.slot_id
        JOIN demand.position p      ON p.id = s.position_id
        JOIN catalogs.position cp   ON cp.id = p.catalog_position_id
        JOIN demand.requisition r   ON r.id = p.requisition_id
        JOIN commercial.hotel h     ON h.id = r.hotel_id
       WHERE e.worker_id = ${workerId}::uuid
         AND e.work_date BETWEEN ${from}::date AND ${to}::date
       ORDER BY e.work_date, lower(e.shift_range)`
  }

  async hotel(id: string): Promise<{ id: string; timeZone: string } | null> {
    return this.prisma.hotel.findUnique({ where: { id }, select: { id: true, timeZone: true } })
  }

  async byId(id: string): Promise<ScheduleRow | null> {
    return this.prisma.schedule.findUnique({ where: { id }, select: SELECT })
  }

  async byWeek(hotelId: string, weekStart: Date): Promise<ScheduleRow | null> {
    return this.prisma.schedule.findFirst({ where: { hotelId, weekStart }, select: SELECT })
  }

  async listAll(hotelId: string | null): Promise<ScheduleRow[]> {
    return this.prisma.schedule.findMany({
      where: hotelId ? { hotelId } : {},
      orderBy: { weekStart: 'desc' },
      take: 50,
      select: SELECT,
    })
  }

  async create(params: {
    hotelId: string
    weekStart: Date
    weekEnd: Date
    userId: string
    roleCode: string
  }): Promise<ScheduleRow> {
    const id = uuidv7()

    await this.prisma.$transaction(async (tx) => {
      await tx.schedule.create({
        data: {
          id,
          hotelId: params.hotelId,
          weekStart: params.weekStart,
          weekEnd: params.weekEnd,
          createdBy: params.userId,
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'operations.schedule',
          entityId: id,
          eventType: 'SCHEDULE_CREATED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { hotelId: params.hotelId, weekStart: params.weekStart.toISOString() },
        },
      })
    })

    return this.prisma.schedule.findUniqueOrThrow({ where: { id }, select: SELECT })
  }

  async assignment(id: string): Promise<{
    id: string
    workerId: string
    status: string
    hotelId: string
    workerName: string
  } | null> {
    const row = await this.prisma.assignment.findUnique({
      where: { id },
      select: {
        id: true,
        workerId: true,
        status: true,
        worker: { select: { fullName: true } },
        slot: { select: { position: { select: { requisition: { select: { hotelId: true } } } } } },
      },
    })

    return row
      ? {
          id: row.id,
          workerId: row.workerId,
          status: row.status,
          hotelId: row.slot.position.requisition.hotelId,
          workerName: row.worker.fullName,
        }
      : null
  }

  async entries(scheduleId: string): Promise<EntryRow[]> {
    return this.prisma.$queryRaw<EntryRow[]>`
      SELECT e.id,
             e.work_date        AS "workDate",
             lower(e.shift_range) AS "startsAt",
             upper(e.shift_range) AS "endsAt",
             e.assignment_id    AS "assignmentId",
             jsonb_build_object('id', w.id, 'fullName', w.full_name) AS worker
        FROM operations.schedule_entry e
        JOIN personal.worker w ON w.id = e.worker_id
       WHERE e.schedule_id = ${scheduleId}::uuid
       ORDER BY e.work_date, lower(e.shift_range)`
  }

  // La hora la teclea el Supervisor EN EL HOTEL, asi que se interpreta en la
  // zona del hotel y no en UTC: un «07:00» de Cancun guardado como 07:00Z son
  // las 02:00 de la manana alla.
  //
  // La conversion la hace Postgres con AT TIME ZONE, que trae la base IANA y
  // sabe de horario de verano; hacerla en JS seria reimplementarla peor.
  async addEntry(params: {
    scheduleId: string
    assignmentId: string
    workerId: string
    workDate: Date
    /// Hora de pared local, «AAAA-MM-DD HH:MM».
    startsLocal: string
    endsLocal: string
    timeZone: string
    userId: string
    roleCode: string
  }): Promise<string> {
    const id = uuidv7()

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO operations.schedule_entry
          (id, schedule_id, assignment_id, worker_id, work_date, shift_range)
        VALUES (
          ${id}::uuid,
          ${params.scheduleId}::uuid,
          ${params.assignmentId}::uuid,
          ${params.workerId}::uuid,
          ${params.workDate.toISOString().slice(0, 10)}::date,
          tstzrange(
            ${params.startsLocal}::timestamp AT TIME ZONE ${params.timeZone},
            ${params.endsLocal}::timestamp   AT TIME ZONE ${params.timeZone},
            '[)')
        )`

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'operations.schedule_entry',
          entityId: id,
          eventType: 'SHIFT_PLANNED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: {
            scheduleId: params.scheduleId,
            workerId: params.workerId,
            workDate: params.workDate.toISOString().slice(0, 10),
          },
        },
      })
    })

    return id
  }

  async removeEntry(params: {
    entryId: string
    scheduleId: string
    userId: string
    roleCode: string
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.scheduleEntry.delete({ where: { id: params.entryId } })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'operations.schedule_entry',
          entityId: params.entryId,
          eventType: 'SHIFT_REMOVED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { scheduleId: params.scheduleId },
        },
      })
    })
  }

  async entryById(id: string): Promise<{ id: string; scheduleId: string; workDate: Date } | null> {
    return this.prisma.scheduleEntry.findUnique({
      where: { id },
      select: { id: true, scheduleId: true, workDate: true },
    })
  }
}
