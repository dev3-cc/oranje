import type { ConfigService } from '@nestjs/config'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { FirebaseAccountsService } from '../../src/infra/firebase/index.js'
import { MailerService } from '../../src/infra/mailer/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { SETTING_KEYS, SettingsService } from '../../src/infra/settings/index.js'
import { MailSettingsService } from '../../src/modules/settings/index.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * El freno de mano del correo (Hugo, 2026-09-26).
 *
 * El respaldo automático cubre el SMTP que FALLA. Esto cubre el otro caso: el
 * SMTP que acepta el correo y no lo entrega, donde el sistema cree que todo
 * salió bien y hace falta que una persona lo fuerce — sin desplegar.
 */
const DESTINO = `interruptor-${Date.now()}@oranje.local`

const SMTP_COMPLETO = {
  MAIL_SMTP_HOST: 'mail.oranjepeople.com',
  MAIL_SMTP_PORT: 465,
  MAIL_SMTP_USER: 'no-reply@oranjepeople.com',
  MAIL_SMTP_PASSWORD: 'secreta',
  MAIL_FROM_NAME: 'Oranje',
  MAIL_FROM_EMAIL: 'no-reply@oranjepeople.com',
}

const config = {
  get: (k: string) => (SMTP_COMPLETO as Record<string, unknown>)[k],
} as ConfigService<never, true>

const firebaseFalso = {
  passwordResetLink: (): Promise<string> => Promise.resolve('https://oranje.test/reset'),
  sendPasswordReset: (): Promise<void> => Promise.resolve(),
} as unknown as FirebaseAccountsService

/* Una sola instancia de ajustes para los dos, como en la app: si cada uno
   tuviera la suya, mover el interruptor tardaría el minuto de la caché y la
   prueba no vería el efecto — y tampoco lo vería el correo. */
const settings = new SettingsService(db as unknown as PrismaService)
const mailer = new MailerService(config, db as unknown as PrismaService, firebaseFalso, settings)
const pantalla = new MailSettingsService(db as unknown as PrismaService, settings, mailer)

let admin: AuthenticatedUser

beforeAll(async () => {
  admin = {
    id: (await actor()).id,
    roleCode: 'ROL-ADM-01',
    hotelId: null,
    departmentId: null,
  }
})

afterAll(async () => {
  await pantalla.setTransport('own', admin)
  await db.emailDelivery.deleteMany({ where: { toEmail: DESTINO } })
  await close()
})

describe('el interruptor de correo', () => {
  it('nace en «own»: el correo sale por lo nuestro', async () => {
    await pantalla.setTransport('own', admin)
    const estado = await pantalla.read()

    expect(estado.transport).toBe('own')
    expect(estado.configured).toBe(true)
    expect(estado.sendingWithOwnServer).toBe(true)
  })

  it('en «firebase» apaga el SMTP aunque esté configurado', async () => {
    await pantalla.setTransport('firebase', admin)

    const estado = await pantalla.read()
    expect(estado.transport).toBe('firebase')
    // Configurado sigue siendo cierto: lo que cambia es la decisión, no el ambiente.
    expect(estado.configured).toBe(true)
    expect(estado.sendingWithOwnServer).toBe(false)
    expect(await mailer.isEnabled()).toBe(false)
  })

  it('con el freno puesto, el correo sale por el respaldo sin intentar el SMTP', async () => {
    await pantalla.setTransport('firebase', admin)

    const resultado = await mailer.sendAccountEmail({
      template: 'account-invitation',
      to: DESTINO,
      name: 'Juan David',
    })

    expect(resultado.transport).toBe('FIREBASE')

    const fila = await db.emailDelivery.findFirst({
      where: { toEmail: DESTINO },
      orderBy: { createdAt: 'desc' },
    })
    // Sin error: no es que el SMTP fallara, es que ni se intentó.
    expect(fila?.error).toBeNull()
  })

  it('quitar el freno lo devuelve a lo nuestro, sin esperar la caché', async () => {
    await pantalla.setTransport('firebase', admin)
    await pantalla.setTransport('own', admin)

    expect(await mailer.isEnabled()).toBe(true)
  })

  it('queda en el journal quién lo movió y de qué a qué', async () => {
    await pantalla.setTransport('firebase', admin)

    const evento = await db.journalEntry.findFirst({
      where: { eventType: 'APP_SETTING_UPDATED' },
      orderBy: { occurredAt: 'desc' },
    })

    expect(evento?.actorUserId).toBe(admin.id)
    expect(evento?.payload).toMatchObject({ key: SETTING_KEYS.mailTransport, to: 'firebase' })
  })

  it('la base rechaza un valor que el código no sabría leer', async () => {
    /* `ck_app_setting_value` no vive en el datamodel de Prisma: lo que lo
       protege es esta prueba. Sin él, un UPDATE a mano deja el correo en un
       estado inventado. */
    await expect(
      db.appSetting.update({
        where: { key: SETTING_KEYS.mailTransport },
        data: { value: 'paloma-mensajera' },
      }),
    ).rejects.toThrow()
  })

  it('el resumen cuenta por dónde ha salido el correo', async () => {
    const estado = await pantalla.read()

    expect(estado.summary.days).toBe(7)
    expect(estado.summary.own + estado.summary.fallback + estado.summary.failed).toBeGreaterThan(0)
    expect(estado.recent.length).toBeGreaterThan(0)
  })
})
