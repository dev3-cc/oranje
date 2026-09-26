import { Injectable } from '@nestjs/common'
import { v5 as uuidv5, v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../common/decorators/index.js'
import { MailerService } from '../../infra/mailer/index.js'
import { PrismaService } from '../../infra/prisma/index.js'
import { SETTING_KEYS, SettingsService } from '../../infra/settings/index.js'

/** Cuánto mira hacia atrás el resumen. Una semana: lo que cabe en la cabeza. */
const RESUMEN_DIAS = 7

export interface MailSettings {
  /** Lo que dice el interruptor. */
  transport: 'own' | 'firebase'
  /** Si el SMTP está configurado en este ambiente: sin esto el interruptor no puede nada. */
  configured: boolean
  /** Si AHORA MISMO el correo sale por lo nuestro (las dos condiciones juntas). */
  sendingWithOwnServer: boolean
  updatedAt: string | null
  summary: { days: number; own: number; fallback: number; failed: number }
  recent: Array<{
    template: string
    toEmail: string
    transport: string
    status: string
    error: string | null
    createdAt: string
  }>
}

/**
 * Lo que la pantalla del Administrador necesita para no ser un interruptor a
 * ciegas: además del valor, **qué ha pasado con el correo**.
 *
 * Sin el resumen, mover el interruptor es un acto de fe; con él se ve si el
 * respaldo se está disparando y por qué.
 */
@Injectable()
export class MailSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly mailer: MailerService,
  ) {}

  async read(): Promise<MailSettings> {
    const [row, deliveries] = await Promise.all([
      this.prisma.appSetting.findUnique({ where: { key: SETTING_KEYS.mailTransport } }),
      this.prisma.emailDelivery.findMany({
        where: { createdAt: { gte: desde(RESUMEN_DIAS) } },
        select: {
          template: true,
          toEmail: true,
          transport: true,
          status: true,
          error: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const transport = row?.value === 'firebase' ? 'firebase' : 'own'

    return {
      transport,
      configured: this.mailer.configured,
      sendingWithOwnServer: await this.mailer.isEnabled(),
      updatedAt: row?.updatedAt.toISOString() ?? null,
      summary: {
        days: RESUMEN_DIAS,
        own: deliveries.filter((d) => d.transport === 'SMTP' && d.status === 'SENT').length,
        fallback: deliveries.filter((d) => d.transport === 'FIREBASE' && d.status === 'SENT')
          .length,
        failed: deliveries.filter((d) => d.status === 'FAILED').length,
      },
      recent: deliveries.slice(0, 10).map((d) => ({
        template: d.template,
        toEmail: d.toEmail,
        transport: d.transport,
        status: d.status,
        error: d.error,
        createdAt: d.createdAt.toISOString(),
      })),
    }
  }

  async setTransport(value: 'own' | 'firebase', actor: AuthenticatedUser): Promise<MailSettings> {
    const antes = await this.settings.get(SETTING_KEYS.mailTransport, 'own')

    await this.settings.set(SETTING_KEYS.mailTransport, value, actor.id)

    /* Al journal y no solo a la tabla: el ajuste guarda el estado actual, el
       journal guarda QUIÉN lo movió y cuántas veces, que es lo que se
       pregunta después de un incidente. */
    await this.prisma.journalEntry.create({
      data: {
        id: uuidv7(),
        entityType: 'catalogs.app_setting',
        /* El journal exige un uuid y un ajuste se identifica por su clave, así
           que se deriva uno ESTABLE de ella (v5): los cambios de una misma
           clave comparten entidad y su historia se puede leer junta, que es
           justo para lo que existe el índice por entidad. */
        entityId: uuidv5(SETTING_KEYS.mailTransport, uuidv5.URL),
        eventType: 'APP_SETTING_UPDATED',
        actorUserId: actor.id,
        actorRole: actor.roleCode,
        payload: { key: SETTING_KEYS.mailTransport, from: antes, to: value },
      },
    })

    return this.read()
  }
}

const desde = (dias: number): Date => new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
