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
  COOKIE_SAME_SITE: 'none',
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

    it('exige la cookie por HTTPS', () => {
      expect(() => validateEnv({ ...DESPLEGADO, COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/)
    })

    // El front (Hosting) y el API (Cloud Run) son sitios distintos: con Strict
    // la cookie de refresh no viajaba y la sesión se perdía al recargar.
    it('exige SameSite=None: el front y el API no comparten sitio', () => {
      expect(() => validateEnv({ ...DESPLEGADO, COOKIE_SAME_SITE: 'strict' })).toThrow(
        /COOKIE_SAME_SITE/,
      )
      expect(validateEnv(DESPLEGADO).COOKIE_SAME_SITE).toBe('none')
    })

    it('None sin Secure no existe para el navegador', () => {
      expect(() =>
        validateEnv({
          ...BASE,
          APP_ENV: 'local',
          JWT_SECRET: 'a'.repeat(32),
          COOKIE_SAME_SITE: 'none',
          COOKIE_SECURE: 'false',
        }),
      ).toThrow(/COOKIE_SECURE/)
    })
  })

  describe('staging puede levantar incompleto, producción no', () => {
    const SIN_FIREBASE_NI_DOMINIO = {
      ...DESPLEGADO,
      AUTH_ISSUER_URL: '',
      AUTH_AUDIENCE: '',
      CORS_ORIGINS: '',
    }

    it('staging arranca sin Firebase ni dominio: sirve para probar los CRUD', () => {
      const env = validateEnv(SIN_FIREBASE_NI_DOMINIO)

      expect(env.AUTH_ISSUER_URL).toBeUndefined()
      expect(env.CORS_ORIGINS).toEqual([])
    })

    it('producción NO arranca sin ellas', () => {
      expect(() => validateEnv({ ...SIN_FIREBASE_NI_DOMINIO, APP_ENV: 'production' })).toThrow(
        /CORS_ORIGINS/,
      )

      expect(() =>
        validateEnv({
          ...SIN_FIREBASE_NI_DOMINIO,
          APP_ENV: 'production',
          CORS_ORIGINS: 'https://app.oranje.mx',
        }),
      ).toThrow(/AUTH_ISSUER_URL/)
    })
  })

  it('trata una variable vacía como ausente', () => {
    expect(() => validateEnv({ ...BASE, APP_ENV: 'local', JWT_SECRET: '' })).toThrow(
      /obligatoria en local/,
    )
  })
})
