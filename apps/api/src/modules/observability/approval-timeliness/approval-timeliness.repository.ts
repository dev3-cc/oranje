import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../../infra/prisma/index.js'

/**
 * Estados de un timesheet que son horas sin aprobar. OPEN cuenta: es la semana
 * que nunca se envió a aprobación. La condición de cierre (la semana ya terminó)
 * la pone quien la usa; este estado solo dice qué cuenta como pendiente.
 */
export const PENDING_TIMESHEET_STATUSES = ['OPEN', 'PENDING_APPROVAL'] as const

/** Condición SQL única de "horas pendientes". La usan el KPI 4, la lista y el aviso. */
export function pendingTimesheetStatus(column: string): Prisma.Sql {
  return Prisma.sql`${Prisma.raw(column)} IN (${Prisma.join([...PENDING_TIMESHEET_STATUSES])})`
}

/** Un renglón por hotel y departamento: lo que el Manager de Área de ese cruce debía aprobar. */
export interface TimelinessRawRow {
  hotelId: string
  hotelName: string
  departmentId: string | null
  departmentName: string | null
  timesheetsTotal: number
  timesheetsOnTime: number
  timesheetsLate: number
  timesheetsPending: number
  punchesTotal: number
  punchesOnTime: number
  lateDaysSum: number
  lateCount: number
}

export interface ManagerRow {
  hotelId: string
  departmentId: string | null
  id: string
  fullName: string
}

@Injectable()
export class ApprovalTimelinessRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Solo semanas CERRADAS: el cierre es el inicio del día siguiente a
   * `week_end` en la zona horaria del hotel. Una semana en curso no está
   * atrasada, todavía.
   *
   * "A tiempo" = APPROVED con `approved_at` en o antes del cierre. Lo que no
   * esté aprobada (OPEN o PENDING_APPROVAL) cuenta como pendiente. Los días de atraso
   * salen del cierre a la aprobación, o a ahora si sigue pendiente.
   */
  async rows(days: number): Promise<TimelinessRawRow[]> {
    return this.prisma.$queryRaw<TimelinessRawRow[]>`
      WITH semanas AS (
        SELECT t.id,
               r.hotel_id,
               h.name        AS hotel_name,
               t.status,
               t.approved_at,
               ((t.week_end + 1)::timestamp AT TIME ZONE h.time_zone) AS cutoff,
               (SELECT p.hotel_department_id
                  FROM demand."position" p
                 WHERE p.requisition_id = t.requisition_id
                 LIMIT 1) AS department_id,
               (SELECT count(*)
                  FROM operations.punch_mark pm
                  JOIN operations.timesheet_day d ON d.id = pm.timesheet_day_id
                 WHERE d.timesheet_id = t.id)::int AS punches
          FROM operations.timesheet t
          JOIN demand.requisition r ON r.id = t.requisition_id
          JOIN commercial.hotel h   ON h.id = r.hotel_id
         WHERE t.week_start >= (CURRENT_DATE - ${days}::int)
      ),
      cerradas AS (
        SELECT s.*,
               (s.status = 'APPROVED' AND s.approved_at <= s.cutoff) AS a_tiempo
          FROM semanas s
         WHERE s.cutoff <= now()
      )
      SELECT c.hotel_id                                AS "hotelId",
             c.hotel_name                              AS "hotelName",
             c.department_id                           AS "departmentId",
             hd.name                                   AS "departmentName",
             count(*)::int                             AS "timesheetsTotal",
             count(*) FILTER (WHERE c.a_tiempo)::int   AS "timesheetsOnTime",
             count(*) FILTER (WHERE c.status = 'APPROVED' AND NOT c.a_tiempo)::int AS "timesheetsLate",
             count(*) FILTER (WHERE ${pendingTimesheetStatus('c.status')})::int AS "timesheetsPending",
             COALESCE(sum(c.punches), 0)::int          AS "punchesTotal",
             COALESCE(sum(c.punches) FILTER (WHERE c.a_tiempo), 0)::int AS "punchesOnTime",
             COALESCE(sum(GREATEST(
               EXTRACT(EPOCH FROM (COALESCE(c.approved_at, now()) - c.cutoff)) / 86400.0, 0))
               FILTER (WHERE NOT c.a_tiempo), 0)::float8 AS "lateDaysSum",
             count(*) FILTER (WHERE NOT c.a_tiempo)::int AS "lateCount"
        FROM cerradas c
        LEFT JOIN catalogs.hotel_department hd ON hd.id = c.department_id
       GROUP BY c.hotel_id, c.hotel_name, c.department_id, hd.name`
  }

  /** Manager de Área activos (ROL-H-02): uno por departamento de cada hotel. */
  async managers(): Promise<ManagerRow[]> {
    return this.prisma.$queryRaw<ManagerRow[]>`
      SELECT u.hotel_id      AS "hotelId",
             u.department_id AS "departmentId",
             u.id,
             u.full_name     AS "fullName"
        FROM identity."user" u
        JOIN identity.role r ON r.id = u.role_id
       WHERE r.code = 'ROL-H-02'
         AND u.is_active
         AND u.hotel_id IS NOT NULL
       ORDER BY u.full_name`
  }
}
