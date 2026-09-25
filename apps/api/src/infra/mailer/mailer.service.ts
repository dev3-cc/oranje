import { randomUUID } from 'node:crypto'

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import nodemailer, { type Transporter } from 'nodemailer'

import type { Env } from '../../config/env.validation.js'
import { FirebaseAccountsService } from '../firebase/index.js'
import { PrismaService } from '../prisma/index.js'

import {
  firebaseFallbackOf,
  renderTemplate,
  type Locale,
  type TemplateData,
  type TemplateName,
} from './templates/index.js'

/** Cuántas veces se insiste con el SMTP antes de soltar y usar el respaldo. */
const MAX_ATTEMPTS = 2
/** Espera entre intentos. Corta: quien pidió el alta está esperando la respuesta. */
const RETRY_DELAY_MS = 400

export interface SendMailInput<K extends TemplateName> {
  template: K
  to: string
  data: TemplateData[K]
  /** El de la persona (`identity.user.locale`). Sin él, español. */
  locale?: Locale | null
  /** Para poder mirar después «qué le hemos mandado a esta persona». */
  userId?: string | null
}

export interface SendMailResult {
  /** Por dónde salió de verdad, que no siempre es por donde se pidió. */
  transport: 'SMTP' | 'FIREBASE'
  status: 'SENT' | 'FAILED'
  attempts: number
}

/**
 * El correo propio de Oranje.
 *
 * Tres reglas que explican todo lo demás:
 *
 * 1. **Sin configurar, no estorba.** Si faltan las variables del SMTP, el
 *    mailer se declara apagado y cada envío sale por Firebase, exactamente
 *    como antes de que esto existiera. Encenderlo es una decisión de
 *    ambiente, no un despliegue de código.
 * 2. **Nunca tumba la operación.** Un correo que no sale no puede reventar el
 *    alta de una persona: todo fallo termina en una fila de
 *    `notifications.email_delivery` y en el log, jamás en una excepción hacia
 *    arriba.
 * 3. **El respaldo es automático.** Si el SMTP falla, el mismo envío se va por
 *    Firebase sin que nadie mire. La fila dice por dónde salió.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name)
  private readonly host: string | undefined
  private readonly port: number | undefined
  private readonly user: string | undefined
  private readonly password: string | undefined
  private readonly fromName: string
  private readonly fromEmail: string | undefined
  private readonly replyTo: string | undefined
  private readonly forced: 'own' | 'firebase'
  private transporter: Transporter | null = null

  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseAccountsService,
  ) {
    this.host = config.get('MAIL_SMTP_HOST', { infer: true })
    this.port = config.get('MAIL_SMTP_PORT', { infer: true })
    this.user = config.get('MAIL_SMTP_USER', { infer: true })
    this.password = config.get('MAIL_SMTP_PASSWORD', { infer: true })
    this.fromName = config.get('MAIL_FROM_NAME', { infer: true }) ?? 'Oranje'
    this.fromEmail = config.get('MAIL_FROM_EMAIL', { infer: true })
    this.replyTo = config.get('MAIL_REPLY_TO', { infer: true })
    this.forced = config.get('MAIL_TRANSPORT', { infer: true })
  }

  /** Mismo criterio que `CPanelService.enabled`: sin las cuatro, no hay SMTP. */
  get enabled(): boolean {
    return (
      this.host !== undefined &&
      this.user !== undefined &&
      this.password !== undefined &&
      this.fromEmail !== undefined &&
      this.forced === 'own'
    )
  }

  /**
   * Manda el correo y devuelve por dónde salió. **No lanza**: ver la regla 2.
   */
  async send<K extends TemplateName>(input: SendMailInput<K>): Promise<SendMailResult> {
    const locale: Locale = input.locale === 'en' ? 'en' : 'es'
    const { subject, html, text } = renderTemplate(input.template, locale, input.data)

    let attempts = 0
    let lastError: unknown = null

    if (this.enabled) {
      while (attempts < MAX_ATTEMPTS) {
        attempts += 1

        try {
          const info = await this.transport().sendMail({
            from: { name: this.fromName, address: this.fromEmail as string },
            ...(this.replyTo !== undefined ? { replyTo: this.replyTo } : {}),
            to: input.to,
            subject,
            text,
            html,
          })

          await this.record(input, locale, subject, {
            transport: 'SMTP',
            status: 'SENT',
            attempts,
            messageId: info.messageId,
          })

          return { transport: 'SMTP', status: 'SENT', attempts }
        } catch (error) {
          lastError = error
          this.logger.warn(
            `Envío ${input.template} a ${input.to} falló (intento ${attempts}/${MAX_ATTEMPTS}): ${messageOf(error)}`,
          )

          if (attempts < MAX_ATTEMPTS) await delay(RETRY_DELAY_MS)
        }
      }
    }

    return this.fallback(input, locale, subject, attempts, lastError)
  }

  /**
   * Los correos de cuenta, que son los que hoy manda Firebase con su plantilla.
   *
   * Aquí está la pieza que permite tener correo propio sin reinventar la
   * seguridad: el enlace lo sigue emitiendo Firebase (uso único, caducidad
   * suya) y nosotros solo lo ponemos dentro de nuestra plantilla.
   *
   * Si el mailer está apagado, ni se pide el enlace: se va directo al
   * respaldo, que es el correo de Firebase de siempre.
   */
  async sendAccountEmail(input: {
    template: 'account-invitation' | 'password-reset'
    to: string
    name: string
    locale?: Locale | null
    userId?: string | null
  }): Promise<SendMailResult> {
    const locale: Locale = input.locale === 'en' ? 'en' : 'es'
    const base = {
      template: input.template,
      to: input.to,
      locale,
      userId: input.userId ?? null,
    }

    if (this.enabled) {
      try {
        const link = await this.firebase.passwordResetLink(input.to)

        return await this.send({ ...base, data: { name: input.name, link } })
      } catch (error) {
        /* Sin enlace no hay correo propio posible; el respaldo de abajo lo
           vuelve a intentar por el camino de Firebase, que es el mismo
           servicio pero otra llamada. */
        this.logger.warn(`No se pudo obtener el enlace para ${input.to}: ${messageOf(error)}`)
      }
    }

    const data = { name: input.name, link: '' }
    const { subject } = renderTemplate(input.template, locale, data)

    return this.fallback({ ...base, data }, locale, subject, 0, null)
  }

  /**
   * El respaldo. Solo sirve para los correos que Firebase sabe mandar: los de
   * cuenta. Para el resto no hay a quién recurrir, así que se registra el
   * fallo y se deja constancia — perderlo en silencio sería lo único
   * inaceptable.
   */
  private async fallback<K extends TemplateName>(
    input: SendMailInput<K>,
    locale: Locale,
    subject: string,
    attempts: number,
    lastError: unknown,
  ): Promise<SendMailResult> {
    if (firebaseFallbackOf(input.template) === null) {
      await this.record(input, locale, subject, {
        transport: 'SMTP',
        status: 'FAILED',
        attempts: Math.max(attempts, 1),
        error: messageOf(
          lastError ?? new Error('Mailer apagado y sin respaldo para esta plantilla'),
        ),
      })

      this.logger.error(`Sin respaldo para ${input.template}: el correo a ${input.to} no salió`)

      return { transport: 'SMTP', status: 'FAILED', attempts }
    }

    try {
      await this.firebase.sendPasswordReset(input.to)

      await this.record(input, locale, subject, {
        transport: 'FIREBASE',
        status: 'SENT',
        attempts: attempts + 1,
        /* El error del SMTP se conserva aunque el correo sí saliera: es la
           única pista de por qué se usó el respaldo. */
        ...(lastError !== null ? { error: messageOf(lastError) } : {}),
      })

      if (lastError !== null) {
        this.logger.warn(`${input.template} a ${input.to} salió por el respaldo de Firebase`)
      }

      return { transport: 'FIREBASE', status: 'SENT', attempts: attempts + 1 }
    } catch (error) {
      await this.record(input, locale, subject, {
        transport: 'FIREBASE',
        status: 'FAILED',
        attempts: attempts + 1,
        error: messageOf(error),
      })

      this.logger.error(`Ni el SMTP ni Firebase pudieron con ${input.template} a ${input.to}`)

      return { transport: 'FIREBASE', status: 'FAILED', attempts: attempts + 1 }
    }
  }

  /** El transportador se arma una sola vez: reusa la conexión entre envíos. */
  private transport(): Transporter {
    if (this.transporter === null) {
      const port = this.port ?? 465

      this.transporter = nodemailer.createTransport({
        host: this.host,
        port,
        /* 465 es TLS desde el saludo; 587 arranca en claro y sube con
           STARTTLS. El 25 no se contempla: Google lo bloquea en todo GCP. */
        secure: port === 465,
        auth: { user: this.user as string, pass: this.password as string },
        pool: true,
        maxConnections: 2,
      })
    }

    return this.transporter
  }

  /**
   * El registro NUNCA hace fallar el envío: si la base no acepta la fila, el
   * correo ya salió y avisar en el log es todo lo que se puede hacer.
   */
  private async record<K extends TemplateName>(
    input: SendMailInput<K>,
    locale: Locale,
    subject: string,
    outcome: {
      transport: 'SMTP' | 'FIREBASE'
      status: 'SENT' | 'FAILED'
      attempts: number
      messageId?: string
      error?: string
    },
  ): Promise<void> {
    try {
      await this.prisma.emailDelivery.create({
        data: {
          id: randomUUID(),
          template: input.template,
          subject,
          locale,
          toEmail: input.to,
          toUserId: input.userId ?? null,
          transport: outcome.transport,
          status: outcome.status,
          attempts: outcome.attempts,
          messageId: outcome.messageId ?? null,
          error: outcome.error?.slice(0, 2000) ?? null,
          sentAt: outcome.status === 'SENT' ? new Date() : null,
        },
      })
    } catch (error) {
      this.logger.error(`No se pudo registrar el envío a ${input.to}: ${messageOf(error)}`)
    }
  }
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
