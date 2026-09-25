import type { ConfigService } from '@nestjs/config'

import type { FirebaseAccountsService } from '../../src/infra/firebase/index.js'
import { MailerService, renderTemplate } from '../../src/infra/mailer/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'

import { close, db } from './db.js'

/**
 * El mailer propio (Hugo, 2026-09-25). Lo que se prueba aquí no es que
 * nodemailer sepa hablar SMTP —eso es suyo—, sino las tres promesas que se le
 * hicieron a producción:
 *
 * 1. sin configurar, se comporta como antes (todo por Firebase);
 * 2. si el SMTP falla, el correo sale igual por el respaldo, solo;
 * 3. pase lo que pase, queda el rastro de por dónde salió.
 *
 * El transportador se sustituye por uno de mentira escribiendo el campo
 * privado: montar un servidor SMTP de verdad probaría a nodemailer, no a
 * nosotros.
 */
const DESTINO = `mailer-prueba-${Date.now()}@oranje.local`

const configCon = (vars: Record<string, string | number | undefined>): ConfigService<never, true> =>
  ({ get: (key: string) => vars[key] }) as unknown as ConfigService<never, true>

const SMTP_COMPLETO = {
  MAIL_SMTP_HOST: 'mail.oranjepeople.com',
  MAIL_SMTP_PORT: 465,
  MAIL_SMTP_USER: 'no-reply@oranjepeople.com',
  MAIL_SMTP_PASSWORD: 'secreta',
  MAIL_FROM_NAME: 'Oranje',
  MAIL_FROM_EMAIL: 'no-reply@oranjepeople.com',
  MAIL_TRANSPORT: 'own',
}

/** Firebase de mentira: cuenta las llamadas y puede fallar a voluntad. */
function firebaseFalso(opciones: { linkFalla?: boolean; envioFalla?: boolean } = {}) {
  const llamadas = { link: 0, envio: 0 }

  const fake = {
    passwordResetLink: (): Promise<string> => {
      llamadas.link += 1

      return opciones.linkFalla === true
        ? Promise.reject(new Error('Identity Toolkit caído'))
        : Promise.resolve('https://oranje.test/reset?oobCode=abc')
    },
    sendPasswordReset: (): Promise<void> => {
      llamadas.envio += 1

      return opciones.envioFalla === true
        ? Promise.reject(new Error('Identity Toolkit caído'))
        : Promise.resolve()
    },
  }

  return { fake: fake as unknown as FirebaseAccountsService, llamadas }
}

/** Le pone al mailer un transportador que responde lo que se le diga. */
function conTransporte(mailer: MailerService, comportamiento: 'ok' | 'falla'): { envios: number } {
  const cuenta = { envios: 0 }

  Object.assign(mailer as unknown as Record<string, unknown>, {
    transporter: {
      sendMail: (): Promise<{ messageId: string }> => {
        cuenta.envios += 1

        return comportamiento === 'ok'
          ? Promise.resolve({ messageId: '<abc@oranjepeople.com>' })
          : Promise.reject(new Error('550 Relay denied'))
      },
    },
  })

  return cuenta
}

const ultimoEnvio = async (to: string) =>
  db.emailDelivery.findFirst({ where: { toEmail: to }, orderBy: { createdAt: 'desc' } })

afterAll(async () => {
  await db.emailDelivery.deleteMany({ where: { toEmail: { contains: '@oranje.local' } } })
  await close()
})

describe('el mailer manda el correo y deja rastro', () => {
  it('sin configurar, el correo sale por Firebase como siempre', async () => {
    const { fake, llamadas } = firebaseFalso()
    const mailer = new MailerService(configCon({}), db as unknown as PrismaService, fake)

    expect(mailer.enabled).toBe(false)

    const resultado = await mailer.sendAccountEmail({
      template: 'account-invitation',
      to: DESTINO,
      name: 'Juan David',
    })

    expect(resultado).toMatchObject({ transport: 'FIREBASE', status: 'SENT' })
    // Ni siquiera pide el enlace: sin mailer no hay plantilla propia que llenar.
    expect(llamadas.link).toBe(0)
    expect(llamadas.envio).toBe(1)

    const fila = await ultimoEnvio(DESTINO)
    expect(fila).toMatchObject({
      transport: 'FIREBASE',
      status: 'SENT',
      template: 'account-invitation',
    })
    expect(fila?.sentAt).not.toBeNull()
  })

  it('configurado, sale por nuestro SMTP y guarda el id del mensaje', async () => {
    const { fake, llamadas } = firebaseFalso()
    const mailer = new MailerService(configCon(SMTP_COMPLETO), db as unknown as PrismaService, fake)

    expect(mailer.enabled).toBe(true)
    const smtp = conTransporte(mailer, 'ok')

    const resultado = await mailer.sendAccountEmail({
      template: 'account-invitation',
      to: DESTINO,
      name: 'Juan David',
    })

    expect(resultado).toMatchObject({ transport: 'SMTP', status: 'SENT', attempts: 1 })
    expect(smtp.envios).toBe(1)
    // El enlace lo sigue emitiendo Firebase; el correo es nuestro.
    expect(llamadas.link).toBe(1)
    expect(llamadas.envio).toBe(0)

    const fila = await ultimoEnvio(DESTINO)
    expect(fila?.messageId).toBe('<abc@oranjepeople.com>')
  })

  it('si el SMTP falla, el correo sale igual por el respaldo y la fila lo delata', async () => {
    const { fake, llamadas } = firebaseFalso()
    const mailer = new MailerService(configCon(SMTP_COMPLETO), db as unknown as PrismaService, fake)
    const smtp = conTransporte(mailer, 'falla')

    const resultado = await mailer.sendAccountEmail({
      template: 'account-invitation',
      to: DESTINO,
      name: 'Juan David',
    })

    expect(resultado.transport).toBe('FIREBASE')
    expect(resultado.status).toBe('SENT')
    // Insiste dos veces antes de soltar.
    expect(smtp.envios).toBe(2)
    expect(llamadas.envio).toBe(1)

    const fila = await ultimoEnvio(DESTINO)
    expect(fila?.transport).toBe('FIREBASE')
    // El error del SMTP se conserva aunque el correo sí saliera: es la pista.
    expect(fila?.error).toContain('550')
  })

  it('si ni el respaldo puede, queda registrado como fallido y nadie revienta', async () => {
    const { fake } = firebaseFalso({ envioFalla: true })
    const mailer = new MailerService(configCon({}), db as unknown as PrismaService, fake)

    const resultado = await mailer.sendAccountEmail({
      template: 'password-reset',
      to: DESTINO,
      name: 'Juan David',
    })

    expect(resultado.status).toBe('FAILED')

    const fila = await ultimoEnvio(DESTINO)
    expect(fila).toMatchObject({ status: 'FAILED', template: 'password-reset' })
    expect(fila?.sentAt).toBeNull()
  })

  it('un envío fallido no puede traer hora de envío: lo impide la base', async () => {
    /* `ck_email_delivery_sent_at` no está en el datamodel de Prisma, así que
       lo que lo protege es esta prueba (el mismo criterio que los índices
       parciales de `coverage`). */
    await expect(
      db.emailDelivery.create({
        data: {
          id: crypto.randomUUID(),
          template: 'account-invitation',
          subject: 'incoherente',
          locale: 'es',
          toEmail: DESTINO,
          transport: 'SMTP',
          status: 'FAILED',
          sentAt: new Date(),
        },
      }),
    ).rejects.toThrow()
  })
})

describe('las plantillas hablan los dos idiomas', () => {
  it('el enlace va dentro, en el botón y escrito completo', () => {
    const { subject, html, text } = renderTemplate('account-invitation', 'es', {
      name: 'Juan David',
      link: 'https://oranje.test/reset?oobCode=abc',
    })

    expect(subject).toBe('Ya tienes cuenta en Oranje')
    expect(html).toContain('Hola Juan David:')
    expect(html).toContain('https://oranje.test/reset?oobCode=abc')
    // La versión en texto no es opcional: sin ella el correo puntúa peor en spam.
    expect(text).toContain('https://oranje.test/reset?oobCode=abc')
  })

  it('en inglés cambia el asunto y el saludo, no la estructura', () => {
    const en = renderTemplate('password-reset', 'en', {
      name: 'Juan David',
      link: 'https://x.test',
    })

    expect(en.subject).toBe('Reset your Oranje password')
    expect(en.html).toContain('Hi Juan David,')
  })

  it('sin nombre no saluda a nadie con una coma suelta', () => {
    const es = renderTemplate('password-reset', 'es', { name: '  ', link: 'https://x.test' })

    expect(es.html).toContain('Hola:')
    expect(es.html).not.toContain('Hola :')
  })
})
