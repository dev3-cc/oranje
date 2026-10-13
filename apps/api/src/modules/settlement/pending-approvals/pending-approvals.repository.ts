import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infra/prisma/index.js'
import { pendingTimesheetStatus } from '../../observability/approval-timeliness/approval-timeliness.repository.js'

export interface PendingTimesheetRow {
  timesheetId: string
  hotelId: string
  hotelName: string
  weekStart: Date
  weekEnd: Date
  /** Inicio del día siguiente a `weekEnd`, en la zona horaria del hotel. */
  cutoff: Date
  departmentId: string | null
  departmentName: string | null
}

export interface ActiveManagerRow {
  hotelId: string
  departmentId: string | null
  id: string
  fullName: string
}

@Injectable()
export class PendingApprovalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Timesheets pendientes (OPEN o PENDING_APPROVAL) de semanas ya cerradas. */
  async pending(params: {
    hotelId?: string | null | undefined
    weekStart?: string | null | undefined
    cutoffFrom?: Date | null | undefined
  }): Promise<PendingTimesheetRow[]> {
    return this.prisma.$queryRaw<PendingTimesheetRow[]>`
      SELECT p.*
        FROM (
          SELECT t.id          AS "timesheetId",
                 r.hotel_id    AS "hotelId",
                 h.name        AS "hotelName",
                 t.week_start  AS "weekStart",
                 t.week_end    AS "weekEnd",
                 ((t.week_end + 1)::timestamp AT TIME ZONE h.time_zone) AS cutoff,
                 dp.hotel_department_id AS "departmentId",
                 hd.name       AS "departmentName"
            FROM operations.timesheet t
            JOIN demand.requisition r ON r.id = t.requisition_id
            JOIN commercial.hotel h   ON h.id = r.hotel_id
            LEFT JOIN LATERAL (
              SELECT p.hotel_department_id
                FROM demand."position" p
               WHERE p.requisition_id = t.requisition_id
               LIMIT 1
            ) dp ON true
            LEFT JOIN catalogs.hotel_department hd ON hd.id = dp.hotel_department_id
           WHERE ${pendingTimesheetStatus('t.status')}
        ) p
       WHERE p.cutoff <= now()
         AND (${params.hotelId ?? null}::uuid IS NULL OR p."hotelId" = ${params.hotelId ?? null}::uuid)
         AND (${params.weekStart ?? null}::date IS NULL OR p."weekStart" = ${params.weekStart ?? null}::date)
         AND (${params.cutoffFrom ?? null}::timestamptz IS NULL OR p.cutoff >= ${params.cutoffFrom ?? null}::timestamptz)
       ORDER BY p."weekStart" DESC, p."hotelName"`
  }

  async activeManagers(): Promise<ActiveManagerRow[]> {
    return this.prisma.$queryRaw<ActiveManagerRow[]>`
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
