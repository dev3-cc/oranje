import type { PrismaService } from '../../src/infra/prisma/index.js'
import type { StorageService } from '../../src/infra/storage/index.js'
import { updateMeSchema } from '../../src/modules/identity/users/dto/update-me.dto.js'
import { MeService } from '../../src/modules/identity/users/me.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * D-36: el idioma de la interfaz vive en la persona (`identity.user.locale`),
 * para que la siga entre dispositivos. Nace en español; PATCH /me lo cambia;
 * el CHECK y el DTO solo aceptan es | en.
 */
const storageFake = { signedUrl: (): Promise<null> => Promise.resolve(null) }
const service = new MeService(
  db as unknown as PrismaService,
  storageFake as unknown as StorageService,
)
let user: { id: string; roleCode: string; hotelId: null; departmentId: null }

beforeAll(async () => {
  user = { id: (await actor()).id, roleCode: 'ROL-SYS-01', hotelId: null, departmentId: null }
})

afterAll(async () => {
  await db.user.update({ where: { id: user.id }, data: { locale: 'es' } })
  await close()
})

describe('el idioma vive en la persona', () => {
  it('nace en español, se cambia a inglés y se lee de vuelta', async () => {
    expect((await service.get(user)).locale).toBe('es')

    const updated = await service.updateLocale(user, updateMeSchema.parse({ locale: 'en' }).locale)
    expect(updated.locale).toBe('en')
    expect((await service.get(user)).locale).toBe('en')
  })

  it('solo es | en: el DTO lo rechaza antes y el CHECK de la base después', async () => {
    expect(() => updateMeSchema.parse({ locale: 'fr' })).toThrow()
    expect(() => updateMeSchema.parse({ locale: 'en', extra: 1 })).toThrow()

    await expect(
      db.$executeRaw`UPDATE identity.user SET locale = 'fr' WHERE id = ${user.id}::uuid`,
    ).rejects.toThrow(/ck_user_locale/)
  })
})
