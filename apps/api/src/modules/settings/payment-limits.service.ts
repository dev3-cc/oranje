import { BadRequestException, Injectable } from '@nestjs/common'
import { v5 as uuidv5, v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../common/decorators/index.js'
import { PrismaService } from '../../infra/prisma/index.js'
import { SETTING_KEYS, SettingsService, type SettingKey } from '../../infra/settings/index.js'
import {
  DEFAULT_PAYMENT_LIMITS,
  HH_MM,
  type PaymentLimits,
} from '../settlement/payment-calendar/payment-calendar.js'

/** Qué clave de ajustes guarda cada límite. */
const KEY_OF: Record<keyof PaymentLimits, SettingKey> = {
  approvalDeadline: SETTING_KEYS.paymentApprovalDeadline,
  paymentCut: SETTING_KEYS.paymentCut,
  emergencySend: SETTING_KEYS.paymentEmergencySend,
  saturdayNotice: SETTING_KEYS.hoursSaturdayNotice,
}

const LIMIT_NAMESPACE = 'oranje.payment-limits'

/**
 * Los límites de pago y aprobación, en `catalogs.app_setting`.
 *
 * Lectura con la caché corta de `SettingsService`: un cambio tarda hasta un
 * minuto en surtir efecto en otras instancias, y en esta al instante. Un valor
 * que no sea HH:mm o que la base tenga guardado a mano cae al valor por defecto
 * en vez de romper el cálculo.
 */
@Injectable()
export class PaymentLimitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async read(): Promise<PaymentLimits> {
    const entries = await Promise.all(
      (Object.keys(KEY_OF) as Array<keyof PaymentLimits>).map(async (limit) => {
        const value = await this.settings.get(KEY_OF[limit], DEFAULT_PAYMENT_LIMITS[limit])

        return [limit, HH_MM.test(value) ? value : DEFAULT_PAYMENT_LIMITS[limit]] as const
      }),
    )

    const limits = {} as PaymentLimits

    for (const [limit, value] of entries) limits[limit] = value

    return limits
  }

  async update(
    patch: Partial<Record<keyof PaymentLimits, string | undefined>>,
    actor: AuthenticatedUser,
  ): Promise<PaymentLimits> {
    const changes = (Object.keys(KEY_OF) as Array<keyof PaymentLimits>).filter(
      (limit) => patch[limit] !== undefined,
    )

    /* El CHECK de `ck_app_setting_value` no valida las claves nuevas (ELSE
       true), así que el formato se valida aquí, siempre, no solo en el DTO. */
    for (const limit of changes) {
      if (!HH_MM.test(patch[limit] as string)) {
        throw new BadRequestException({
          code: 'PAYMENT_LIMIT_FORMAT',
          message: 'La hora debe ir en formato HH:mm',
        })
      }
    }

    const before = await this.read()
    const after: PaymentLimits = { ...before }

    for (const limit of changes) after[limit] = patch[limit] as string

    /* El aprobación debe cerrar antes del corte del mismo miércoles; si no, el
       corte pagaría horas que todavía no tenían plazo. */
    if (after.approvalDeadline >= after.paymentCut) {
      throw new BadRequestException({
        code: 'PAYMENT_LIMITS_ORDER',
        message: 'El plazo de aprobación debe ser antes del corte de pago del miércoles',
      })
    }

    for (const limit of changes) {
      const to = after[limit]
      const from = before[limit]

      if (to === from) continue

      await this.settings.set(KEY_OF[limit], to, actor.id)

      /* Al journal, como el interruptor del correo: el ajuste guarda el valor,
         el journal guarda quién lo movió y de qué a qué. La entidad se deriva
         de la clave para que la historia de cada límite se lea junta. */
      await this.prisma.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'catalogs.app_setting',
          entityId: uuidv5(KEY_OF[limit], uuidv5(LIMIT_NAMESPACE, uuidv5.URL)),
          eventType: 'APP_SETTING_UPDATED',
          actorUserId: actor.id,
          actorRole: actor.roleCode,
          payload: { key: KEY_OF[limit], from, to },
        },
      })
    }

    return this.read()
  }
}
