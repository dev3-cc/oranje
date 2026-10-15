import { Injectable } from '@nestjs/common'
import { v5 as uuidv5, v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { MailerService } from '../../../infra/mailer/index.js'
import { PrismaService } from '../../../infra/prisma/index.js'
import { PaymentLimitsService } from '../../settings/payment-limits.service.js'
import {
  addDays,
  closedWeekForSaturday,
  weekCalendar,
} from '../payment-calendar/payment-calendar.js'
import { assertMonday } from '../payment-runs/payment-runs.service.js'

import { HoursWeekNoticeRepository } from './hours-week-notice.repository.js'

const NOTICE_ENTITY_TYPE = 'settlement.hours_week_notice'
const NOTICE_EVENT = 'HOURS_WEEK_NOTICE_SENT'
const NOTICE_NAMESPACE = 'oranje.hours-week-notice'

export type NoticeStatus = 'SENT' | 'NOT_DUE' | 'ALREADY_SENT' | 'NO_RECIPIENTS' | 'FAILED'

export interface NoticeHotelResult {
  hotelId: string
  hotelName: string
  weekStart: string
  status: NoticeStatus
  recipients: number
  sent: number
  approved: number
  pending: number
}

export interface NoticeRunResult {
  hotels: NoticeHotelResult[]
}

/**
 * El correo del sábado: para cada hotel, el estado de las horas de la semana
 * que cerró, al Supervisor y al Manager de Área. Sale siempre, con o sin
 * pendientes: el silencio no se lee como «todo bien».
 *
 * Sin `weekStart`, cada hotel recibe la semana que cerró en SU zona (el domingo
 * que hace seis días). Con `weekStart`, se manda esa semana a todos los hoteles
 * (útil para reenviar un sábado perdido).
 *
 * Un hotel solo sale cuando su sábado a la hora configurada ya llegó; una
 * corrida antes responde NOT_DUE y no manda nada. Un hotel ya avisado para esa
 * semana responde ALREADY_SENT: un programador que llame cada hora no duplica.
 *
 * Es un servicio y un endpoint, no un cron (pendiente, como el de pagos).
 */
@Injectable()
export class HoursWeekNoticeService {
  constructor(
    private readonly repo: HoursWeekNoticeRepository,
    private readonly limits: PaymentLimitsService,
    private readonly mailer: MailerService,
    private readonly prisma: PrismaService,
  ) {}

  async run(
    params: { weekStart?: string | undefined; hotelId?: string | undefined },
    actor: AuthenticatedUser | null,
    now: Date = new Date(),
  ): Promise<NoticeRunResult> {
    if (params.weekStart !== undefined) assertMonday(params.weekStart)

    const limits = await this.limits.read()
    const hotels = await this.repo.hotels(params.hotelId)
    const results: NoticeHotelResult[] = []

    for (const hotel of hotels) {
      const weekStart = params.weekStart ?? closedWeekForSaturday(now, hotel.timeZone)
      const calendar = weekCalendar(weekStart, hotel.timeZone, limits)
      const base = { hotelId: hotel.hotelId, hotelName: hotel.hotelName, weekStart }

      if (now.getTime() < calendar.saturdayNotice.getTime()) {
        results.push({
          ...base,
          status: 'NOT_DUE',
          recipients: 0,
          sent: 0,
          approved: 0,
          pending: 0,
        })
        continue
      }

      if (await this.alreadySent(hotel.hotelId, weekStart)) {
        results.push({
          ...base,
          status: 'ALREADY_SENT',
          recipients: 0,
          sent: 0,
          approved: 0,
          pending: 0,
        })
        continue
      }

      const recipients = await this.repo.recipients(hotel.hotelId)
      const counts = await this.repo.counts(hotel.hotelId, weekStart)

      if (recipients.length === 0) {
        results.push({ ...base, status: 'NO_RECIPIENTS', recipients: 0, sent: 0, ...counts })
        continue
      }

      let sent = 0

      for (const recipient of recipients) {
        const outcome = await this.mailer.send({
          template: 'hours-week-status',
          to: recipient.email,
          locale: recipient.locale === 'en' ? 'en' : 'es',
          userId: recipient.userId,
          data: {
            name: recipient.fullName,
            hotelName: hotel.hotelName,
            weekStart,
            weekEnd: addDays(weekStart, 6),
            approved: counts.approved,
            pending: counts.pending,
          },
        })

        if (outcome.status === 'SENT') sent += 1
      }

      /* El journal se escribe solo si alguien lo recibió: si nadie salió, la
         siguiente corrida lo vuelve a intentar en vez de darlo por enviado. */
      if (sent > 0) {
        await this.prisma.journalEntry.create({
          data: {
            id: uuidv7(),
            entityType: NOTICE_ENTITY_TYPE,
            entityId: noticeEntityId(hotel.hotelId, weekStart),
            eventType: NOTICE_EVENT,
            actorUserId: actor?.id ?? null,
            actorRole: actor?.roleCode ?? null,
            payload: {
              hotelId: hotel.hotelId,
              weekStart,
              recipients: recipients.length,
              sent,
              ...counts,
            },
          },
        })
      }

      results.push({
        ...base,
        status: sent > 0 ? 'SENT' : 'FAILED',
        recipients: recipients.length,
        sent,
        ...counts,
      })
    }

    return { hotels: results }
  }

  private async alreadySent(hotelId: string, weekStart: string): Promise<boolean> {
    const row = await this.prisma.journalEntry.findFirst({
      where: {
        entityType: NOTICE_ENTITY_TYPE,
        entityId: noticeEntityId(hotelId, weekStart),
        eventType: NOTICE_EVENT,
      },
      select: { id: true },
    })

    return row !== null
  }
}

export function noticeEntityId(hotelId: string, weekStart: string): string {
  return uuidv5(`${hotelId}|${weekStart}`, uuidv5(NOTICE_NAMESPACE, uuidv5.URL))
}
