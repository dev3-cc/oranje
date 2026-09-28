import type { ConfigService } from '@nestjs/config'

import type { FirebaseAccountsService } from '../../src/infra/firebase/index.js'
import { MailerService, renderTemplate } from '../../src/infra/mailer/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { SettingsService } from '../../src/infra/settings/index.js'
import { PasswordResetService } from '../../src/modules/identity/auth/password-reset.service.js'

import { close, db } from './db.js'

/**
 * El correo de gerencia (Hugo, 2026-09-28) y la recuperación con sobre propio.
 *
 * Lo que se prueba no es que el texto sea bonito, sino las dos decisiones:
 * que la plantilla se elige **por el rol** y sin que nadie tenga que acordarse,
 * y que pedir un restablecimiento **no revela si la cuenta existe**.
 */
const SMTP = {
  MAIL_SMTP_HOST: 'mail.oranjepeople.com',
  MAIL_SMTP_PORT: 465,
  MAIL_SMTP_USER: 'no-reply@oranjepeople.com',
  MAIL_SMTP_PASSWORD: 'secreta',
  MAIL_FROM_NAME: 'Oranje',
  MAIL_FROM_EMAIL: 'no-reply@oranjepeople.com',
}

const config = {
  get: (k: string) => (SMTP as Record<string, unknown>)[k],
} as ConfigService<never, true>

const firebaseFalso = {
  passwordResetLink: (): Promise<string> => Promise.resolve('https://oranje.test/reset?oobCode=x'),
  sendPasswordReset: (): Promise<void> => Promise.resolve(),
} as unknown as FirebaseAccountsService

const settings = new SettingsService(db as unknown as PrismaService)
const mailer = new MailerService(config, db as unknown as PrismaService, firebaseFalso, settings)
const resets = new PasswordResetService(db as unknown as PrismaService, mailer)

/** Un transportador que guarda lo que se le pidió mandar, sin mandar nada. */
const enviados: Array<{ to: string; subject: string; html: string }> = []

Object.assign(mailer as unknown as Record<string, unknown>, {
  transporter: {
    sendMail: (mail: { to: string; subject: string; html: string }) => {
      enviados.push({ to: mail.to, subject: mail.subject, html: mail.html })

      return Promise.resolve({ messageId: '<x@oranjepeople.com>' })
    },
  },
})

afterAll(async () => {
  await db.emailDelivery.deleteMany({ where: { toEmail: { contains: '@oranje.local' } } })
  await close()
})

describe('el correo de gerencia se elige por el rol', () => {
  it('a un Manager le llega su plantilla, con el puesto por su nombre', async () => {
    const to = `gerencia-${Date.now()}@oranje.local`

    await mailer.sendAccountEmail({
      kind: 'invitation',
      to,
      name: 'Aldo Mena Ruiz',
      roleCode: 'ROL-H-03',
      roleName: 'Manager General',
    })

    const correo = enviados.at(-1)
    expect(correo?.subject).toBe('Tu acceso de Manager General en Oranje')
    // Saluda por el nombre de pila, no por el nombre completo.
    expect(correo?.html).toContain('Bienvenido, Aldo')
    expect(correo?.html).toContain('Manager General')
  })

  it('a una Reclutadora le llega la de siempre, sin puesto', async () => {
    const to = `normal-${Date.now()}@oranje.local`

    await mailer.sendAccountEmail({
      kind: 'invitation',
      to,
      name: 'Ana Rivera',
      roleCode: 'ROL-R-01',
      roleName: 'Reclutadora',
    })

    const correo = enviados.at(-1)
    expect(correo?.subject).not.toContain('Reclutadora')
  })

  it('sin rol, la normal: nunca se queda sin correo por no saber el puesto', async () => {
    const to = `sinrol-${Date.now()}@oranje.local`

    await mailer.sendAccountEmail({ kind: 'invitation', to, name: 'Quien Sea' })

    expect(enviados.at(-1)?.subject).toBe('Te damos la bienvenida a Oranje')
  })

  it('en inglés cambia el asunto, no la plantilla elegida', () => {
    const en = renderTemplate('management-invitation', 'en', {
      name: 'Aldo Mena',
      link: 'https://x.test',
      roleName: 'General Manager',
    })

    expect(en.subject).toBe('Your General Manager access at Oranje')
    expect(en.html).toContain('Welcome, Aldo')
  })
})

describe('«¿Olvidaste tu contraseña?» ya sale con nuestro sobre', () => {
  it('a una cuenta real le llega, y con la plantilla de su rol', async () => {
    const persona = await db.user.findFirst({
      where: { isActive: true, role: { code: 'ROL-ADM-01' } },
      select: { email: true },
    })

    expect(persona).not.toBeNull()
    await resets.request(persona?.email ?? '')

    const correo = enviados.at(-1)
    expect(correo?.to).toBe(persona?.email)
    expect(correo?.subject).toContain('contraseña')
  })

  it('a una cuenta que no existe no le manda nada, y tampoco lo dice', async () => {
    const antes = enviados.length

    /* No lanza: quien pregunta recibe lo mismo exista o no la cuenta — si
       distinguiera, esta ruta pública diría quién tiene cuenta en Oranje. */
    await expect(resets.request('nadie-aqui@oranje.local')).resolves.toBeUndefined()
    expect(enviados.length).toBe(antes)
  })
})
