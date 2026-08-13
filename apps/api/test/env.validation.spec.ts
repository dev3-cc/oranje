import { validateEnv } from '../src/config/env.validation.js'

const BASE = {
  DATABASE_URL: 'postgresql://app_user:x@localhost:5433/oranje',
  AUTH_ISSUER_URL: 'https://securetoken.google.com/oranje',
  AUTH_AUDIENCE: 'oranje',
  STORAGE_BUCKET: 'oranje-files',
}

const DESPLEGADO = {
  ...BASE,
  APP_ENV: 'staging',
  JWT_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----',
  JWT_PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----\nx\n-----END PUBLIC KEY-----',
  COOKIE_SECURE: 'true',
  CORS_ORIGINS: 'https://app.oranje.mx',
}

describe('validateEnv', () => {
  describe('local', () => {
    it('acepta secreto compartido y cookie sin HTTPS', () => {
      const env = validateEnv({ ...BASE, APP_ENV: 'local', JWT_SECRET: 'a'.repeat(32) })

      expect(env.APP_ENV).toBe('local')
      expect(env.COOKIE_SECURE).toBe(true)
    })

    it('exige decir como quién trabajas si apagas la autenticación', () => {
      expect(() =>
        validateEnv({
          ...BASE,
          APP_ENV: 'local',
          JWT_SECRET: 'a'.repeat(32),
          AUTH_DISABLED: 'true',
        }),
      ).toThrow(/AUTH_DEV_USER_EMAIL/)
    })
  })

  describe('desplegado', () => {
    it('arranca con el par de llaves y la lista blanca', () => {
      const env = validateEnv(DESPLEGADO)

      expect(env.CORS_ORIGINS).toEqual(['https://app.oranje.mx'])
    })

    it('NO deja apagar la autenticación', () => {
      expect(() => validateEnv({ ...DESPLEGADO, AUTH_DISABLED: 'true' })).toThrow(
        /no se admite en staging/,
      )
    })

    it('exige el par de llaves: un secreto compartido no basta', () => {
      const sinLlaves = { ...DESPLEGADO, JWT_PRIVATE_KEY: '', JWT_PUBLIC_KEY: '' }

      expect(() => validateEnv({ ...sinLlaves, JWT_SECRET: 'a'.repeat(32) })).toThrow(
        /JWT_PRIVATE_KEY/,
      )
    })

    it('rechaza el emulador de Firebase, que no verifica firmas', () => {
      expect(() =>
        validateEnv({ ...DESPLEGADO, AUTH_ISSUER_URL: 'http://localhost:9099' }),
      ).toThrow(/emulador/)
    })

    it('exige cookie por HTTPS y lista blanca de orígenes', () => {
      expect(() => validateEnv({ ...DESPLEGADO, COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/)
      expect(() => validateEnv({ ...DESPLEGADO, CORS_ORIGINS: '' })).toThrow(/CORS_ORIGINS/)
    })
  })

  it('trata una variable vacía como ausente', () => {
    expect(() => validateEnv({ ...BASE, APP_ENV: 'local', JWT_SECRET: '' })).toThrow(
      /obligatoria en local/,
    )
  })
})
