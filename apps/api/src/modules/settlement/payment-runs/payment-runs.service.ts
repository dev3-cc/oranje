import { BadRequestException, Injectable } from '@nestjs/common'
import { v5 as uuidv5, v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { PrismaService } from '../../../infra/prisma/index.js'
import { PaymentLimitsService } from '../../settings/payment-limits.service.js'
import { weekCalendar } from '../payment-calendar/payment-calendar.js'

import { PaymentRunsRepository, type RunKind } from './payment-runs.repository.js'

export const PAYMENT_SLOTS = ['WEDNESDAY_CUT', 'THURSDAY_EMERGENCY'] as const
export type PaymentSlot = (typeof PAYMENT_SLOTS)[number]

/** Cada corrida escribe en su propio consolidado: el jueves nunca toca el del miércoles. */
const RUN_KIND: Record<PaymentSlot, RunKind> = {
  WEDNESDAY_CUT: 'REGULAR',
  THURSDAY_EMERGENCY: 'EMERGENCY',
}

const RUN_NAMESPACE = 'oranje.payment-run'

export interface PaymentRunHotel {
  hotelId: string
  hotelName: string
  /** Instante del corte o del envío, en la zona del hotel, como ISO. */
  runAt: string
  /**
   * RAN: se corrió (puede no haber cambiado nada si ya estaba todo).
   * NOT_DUE: el corte todavía no llega en este hotel; no se toca nada.
   */
  status: 'RAN' | 'NOT_DUE'
  created: number
  topped: number
  /** Horas aprobadas que no entran porque su consolidado ya no está en borrador. */
  blocked: number
}

export interface PaymentRunResult {
  weekStart: string
  slot: PaymentSlot
  hotels: PaymentRunHotel[]
}

/**
 * El pago en dos tiempos de una semana cerrada, por hotel.
 *
 *   Miércoles (corte):   paga lo aprobado hasta el corte de pago del hotel.
 *   Jueves (emergencia): paga lo aprobado después del corte, hasta el envío.
 *
 * El jueves no toca el consolidado del miércoles: escribe el suyo (EMERGENCY),
 * con las horas aprobadas después del corte. Lo que ya está en algún
 * consolidado no vuelve a entrar, así que la corrida es idempotente.
 *
 * Es un servicio y un endpoint, no un cron: el disparador (manual de
 * Contabilidad o un programador) lo decide quien lo llame. Una corrida antes
 * de su instante responde NOT_DUE por hotel en vez de adelantar el pago.
 */
@Injectable()
export class PaymentRunsService {
  constructor(
    private readonly repo: PaymentRunsRepository,
    private readonly limits: PaymentLimitsService,
    private readonly prisma: PrismaService,
  ) {}

  async run(
    params: { weekStart: string; slot: PaymentSlot; hotelId?: string | undefined },
    user: AuthenticatedUser,
    now: Date = new Date(),
  ): Promise<PaymentRunResult> {
    assertMonday(params.weekStart)

    const limits = await this.limits.read()
    const hotels = await this.repo.hotelsWithApprovedHours(params.weekStart, params.hotelId)
    const results: PaymentRunHotel[] = []

    for (const hotel of hotels) {
      const calendar = weekCalendar(params.weekStart, hotel.timeZone, limits)
      const runAt = params.slot === 'WEDNESDAY_CUT' ? calendar.paymentCut : calendar.emergencySend

      if (now.getTime() < runAt.getTime()) {
        results.push({
          hotelId: hotel.hotelId,
          hotelName: hotel.hotelName,
          runAt: runAt.toISOString(),
          status: 'NOT_DUE',
          created: 0,
          topped: 0,
          blocked: 0,
        })
        continue
      }

      const outcome = await this.repo.generate({
        hotelId: hotel.hotelId,
        weekStart: params.weekStart,
        runAt,
        userId: user.id,
        slot: params.slot,
        runKind: RUN_KIND[params.slot],
        after: params.slot === 'THURSDAY_EMERGENCY' ? calendar.paymentCut : null,
      })

      if (outcome.created + outcome.topped > 0) {
        await this.prisma.journalEntry.create({
          data: {
            id: uuidv7(),
            entityType: 'settlement.payment_run',
            entityId: uuidv5(
              `${hotel.hotelId}|${params.weekStart}|${params.slot}`,
              uuidv5(RUN_NAMESPACE, uuidv5.URL),
            ),
            eventType: 'PAYMENT_RUN_EXECUTED',
            actorUserId: user.id,
            actorRole: user.roleCode,
            payload: {
              hotelId: hotel.hotelId,
              weekStart: params.weekStart,
              slot: params.slot,
              runAt: runAt.toISOString(),
              ...outcome,
            },
          },
        })
      }

      results.push({
        hotelId: hotel.hotelId,
        hotelName: hotel.hotelName,
        runAt: runAt.toISOString(),
        status: 'RAN',
        ...outcome,
      })
    }

    return { weekStart: params.weekStart, slot: params.slot, hotels: results }
  }
}

export function assertMonday(weekStart: string): void {
  const day = new Date(`${weekStart}T00:00:00Z`)

  if (Number.isNaN(day.getTime()) || day.getUTCDay() !== 1) {
    throw new BadRequestException({
      code: 'WEEK_MUST_START_MONDAY',
      message: 'La semana de nómina empieza en lunes',
    })
  }
}
