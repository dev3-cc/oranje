import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infra/prisma/index.js'
import { pendingTimesheetStatus } from '../../observability/approval-timeliness/approval-timeliness.repository.js'

export interface NoticeHotel {
  hotelId: string
  hotelName: string
  timeZone: string
}

export interface NoticeRecipient {
  userId: string
  email: string
  fullName: string
  locale: string
}

export interface WeekCounts {
  approved: number
  pending: number
}

@Injectable()
export class HoursWeekNoticeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async hotels(hotelId?: string): Promise<NoticeHotel[]> {
    return this.prisma.$queryRaw<NoticeHotel[]>`
      SELECT h.id AS "hotelId", h.name AS "hotelName", h.time_zone AS "timeZone"
        FROM commercial.hotel h
       WHERE ${hotelId ?? null}::uuid IS NULL OR h.id = ${hotelId ?? null}::uuid
       ORDER BY h.name`
  }

  /** Supervisor (ROL-H-01) y Manager de Área (ROL-H-02) activos del hotel. */
  async recipients(hotelId: string): Promise<NoticeRecipient[]> {
    return this.prisma.$queryRaw<NoticeRecipient[]>`
      SELECT u.id        AS "userId",
             u.email     AS email,
             u.full_name AS "fullName",
             u.locale    AS locale
        FROM identity."user" u
        JOIN identity.role r ON r.id = u.role_id
       WHERE r.code IN ('ROL-H-01', 'ROL-H-02')
         AND u.is_active
         AND u.hotel_id = ${hotelId}::uuid
         AND u.email IS NOT NULL
       ORDER BY u.full_name`
  }

  /** Hojas de horas de la semana: aprobadas, y pendientes de semanas ya cerradas. */
  async counts(hotelId: string, weekStart: string): Promise<WeekCounts> {
    const rows = await this.prisma.$queryRaw<Array<{ approved: number; pending: number }>>`
      SELECT count(*) FILTER (WHERE t.status = 'APPROVED')::int AS approved,
             count(*) FILTER (WHERE ${pendingTimesheetStatus('t.status')})::int AS pending
        FROM operations.timesheet t
        JOIN demand.requisition r ON r.id = t.requisition_id
       WHERE r.hotel_id = ${hotelId}::uuid
         AND t.week_start = ${weekStart}::date`

    return rows[0] ?? { approved: 0, pending: 0 }
  }
}
