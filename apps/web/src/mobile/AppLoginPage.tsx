import { zodResolver } from '@hookform/resolvers/zod'
import type { I18n, MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { Input } from '@oranje/ui'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'

import { useAppSelector } from '@/app/hooks'
import { useCreateSessionMutation } from '@/app/sessionApi'
import { selectSessionStatus } from '@/app/sessionSlice'
import logoAnimado from '@/assets/loader/oranje-sidebar-light.lottie'
import { LanguageSwitch } from '@/shared/components/LanguageSwitch'
import { requestPasswordReset, signInWithEmail } from '@/shared/lib/firebase'

/**
 * El login de la APP: una sola puerta para el Colaborador y para el hotel.
 * Después de entrar, `/` (`MobileRoleHome`) manda a cada quien a su apartado.
 *
 * No es el `LoginPage` del web porque aquel tiene dos puertas —staff y
 * Colaborador— que se enlazan entre sí, y sus textos son de una o de otra.
 * Aquí no hay a dónde enlazar. El canje de sesión, Firebase y la recuperación
 * son las MISMAS funciones compartidas, y los textos repiten los del web
 * palabra por palabra donde aplican, para reusar su traducción (D-36).
 */

/** Hoteles de fondo: las mismas fotos del login del web (Unsplash, decorativas). */
const HOTEL_PHOTOS: readonly string[] = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=640&q=55',
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=640&q=55',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=640&q=55',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=640&q=55',
  'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=640&q=55',
  'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=640&q=55',
]

/** Dos bloques iguales apilados: el paneo a `-50%` cae justo donde empieza la copia. */
function HotelBackdrop(): ReactNode {
  const block = [...HOTEL_PHOTOS, ...HOTEL_PHOTOS, ...HOTEL_PHOTOS]
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <motion.div
        animate={{ y: ['0%', '-50%'] }}
        transition={{ duration: 180, repeat: Infinity, ease: 'linear' }}
        className="flex flex-col"
      >
        {[0, 1].map((copy) => (
          <div key={copy} className="grid grid-cols-2 gap-3 px-3 py-1.5">
            {block.map((src, index) => (
              <img
                key={`${String(copy)}-${String(index)}`}
                src={src}
                alt=""
                loading="lazy"
                className="h-44 w-full rounded-lg object-cover"
              />
            ))}
          </div>
        ))}
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-b from-surface-2/85 via-surface-2/70 to-surface-2/90 backdrop-blur-[2px]" />
    </div>
  )
}

/** Mismos mensajes que `features/auth/types/login.schema.ts`. */
function buildLoginSchema(i18n: I18n) {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, i18n._(msg`Escribe tu correo`))
      .email(i18n._(msg`Escribe un correo válido, como ana@oranje.mx`)),
    password: z.string().min(1, i18n._(msg`Escribe tu contraseña`)),
  })
}

type LoginFormValues = z.infer<ReturnType<typeof buildLoginSchema>>

/** Mismo criterio que el login del web: no se revela cuál mitad falló. */
function loginErrorMessage(error: unknown): MessageDescriptor {
  const failure = (error ?? {}) as {
    status?: number | string
    data?: { error?: { code?: string } }
  }
  const code = failure.data?.error?.code ?? ''
  if (
    failure.status === 'FETCH_ERROR' ||
    failure.status === 'TIMEOUT_ERROR' ||
    (typeof failure.status === 'number' && failure.status >= 500)
  ) {
    return msg`No pudimos conectar con Oranje. Revisa tu conexión e inténtalo en un momento.`
  }
  if (code === 'LOGIN_NOT_CONFIGURED') {
    return msg`El acceso no está configurado en este ambiente. Avisa al Administrador.`
  }
  if (code === 'USER_NOT_REGISTERED' || code === 'USER_INACTIVE') {
    return msg`Tu cuenta no está activa en Oranje. Pide al Administrador que la active.`
  }
  return msg`El correo o la contraseña no coinciden. Revísalos e inténtalo de nuevo.`
}

type AuthMode = 'login' | 'reset'

export function AppLoginPage(): ReactNode {
  const { t, i18n } = useLingui()
  const status = useAppSelector(selectSessionStatus)
  const navigate = useNavigate()
  const location = useLocation()
  const [createSession] = useCreateSessionMutation()
  const [mode, setMode] = useState<AuthMode>('login')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [resetSentTo, setResetSentTo] = useState<string | null>(null)

  const schema = useMemo(() => buildLoginSchema(i18n), [i18n, i18n.locale])

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(schema) })

  /** `from` es a dónde iba (p. ej. el QR del acceso); sin él, `/` reparte por rol. */
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (status === 'authenticated') return <Navigate to={from} replace />

  async function onSubmit(values: LoginFormValues): Promise<void> {
    setSubmitError(null)
    try {
      const idToken = await signInWithEmail(values.email, values.password)
      await createSession({ idToken }).unwrap()
      await navigate(from, { replace: true })
    } catch (error) {
      setSubmitError(i18n._(loginErrorMessage(error)))
    }
  }

  async function onRequestReset(): Promise<void> {
    const email = getValues('email').trim()
    if (!email) {
      setSubmitError(t`Escribe tu correo y te mandamos el enlace.`)
      return
    }
    setSubmitError(null)
    try {
      await requestPasswordReset(email)
    } finally {
      setResetSentTo(email)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-surface-2 p-4">
      <HotelBackdrop />

      <motion.section
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex w-full max-w-md flex-col gap-8 rounded-2xl border border-white/50 bg-surface/62 p-6 shadow-xl backdrop-blur-2xl min-[400px]:p-8"
      >
        <div role="img" aria-label="Oranje" className="h-6 aspect-[1024/120] self-start">
          <DotLottieReact src={logoAnimado} loop autoplay />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {mode === 'login' ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-8"
            >
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-ink">
                  <Trans>Entra a Oranje</Trans>
                </h1>
                <p className="text-sm text-ink-3">
                  <Trans>Tu turno o la operación de tu hotel, en tu celular.</Trans>
                </p>
              </div>

              <form
                className="flex flex-col gap-5"
                onSubmit={(event) => {
                  void handleSubmit(onSubmit)(event)
                }}
                noValidate
              >
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className="text-sm font-medium text-ink-2">
                    <Trans>Correo</Trans>
                  </label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    placeholder="ana@oranjepeople.com"
                    className="h-auto px-4 py-3"
                    {...register('email')}
                  />
                  {errors.email && <p className="text-sm text-red">{errors.email.message}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="text-sm font-medium text-ink-2">
                      <Trans>Contraseña</Trans>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setSubmitError(null)
                        setResetSentTo(null)
                        setMode('reset')
                      }}
                      className="min-h-11 text-xs font-semibold text-o-700"
                    >
                      <Trans>¿La olvidaste?</Trans>
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={isPasswordVisible ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="h-auto px-4 py-3 pr-12"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsPasswordVisible((visible) => !visible)
                      }}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-3"
                      aria-label={isPasswordVisible ? t`Ocultar contraseña` : t`Mostrar contraseña`}
                    >
                      <span className="material-icons-outlined text-xl leading-none" aria-hidden>
                        {isPasswordVisible ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-red">{errors.password.message}</p>}
                </div>

                {submitError && (
                  <p role="alert" className="rounded-md bg-surface-2 p-3 text-sm text-red">
                    {submitError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-12 rounded-md bg-o-300 px-4 py-3 text-sm font-semibold text-ink shadow-xs transition-colors active:bg-o-400 disabled:opacity-60"
                >
                  {isSubmitting ? t`Iniciando sesión…` : t`Iniciar sesión`}
                </button>
              </form>

              <p className="text-xs text-ink-3">
                <Trans>
                  ¿Sin acceso? Si eres colaborador, tu Reclutadora te da de alta. Si trabajas en un
                  hotel, pide el alta a tu Manager.
                </Trans>
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="reset"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-8"
            >
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-ink">
                  <Trans>Recupera tu contraseña</Trans>
                </h1>
                <p className="text-sm text-ink-3">
                  <Trans>Te mandamos un enlace al correo para crear una nueva.</Trans>
                </p>
              </div>

              {resetSentTo ? (
                <p className="rounded-md bg-surface-2 p-4 text-sm text-ink-2">
                  <Trans>
                    Si <span className="font-semibold">{resetSentTo}</span> está registrado en
                    Oranje, el enlace ya va en camino. Revisa también la carpeta de spam.
                  </Trans>
                </p>
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="email" className="text-sm font-medium text-ink-2">
                      <Trans>Correo</Trans>
                    </label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      autoCapitalize="none"
                      placeholder="ana@oranjepeople.com"
                      className="h-auto px-4 py-3"
                      {...register('email')}
                    />
                  </div>

                  {submitError && (
                    <p role="alert" className="rounded-md bg-surface-2 p-3 text-sm text-red">
                      {submitError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      void onRequestReset()
                    }}
                    className="min-h-12 rounded-md bg-o-300 px-4 py-3 text-sm font-semibold text-ink shadow-xs transition-colors active:bg-o-400"
                  >
                    <Trans>Enviar enlace</Trans>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setSubmitError(null)
                  setMode('login')
                }}
                className="min-h-11 self-start text-sm font-semibold text-o-700"
              >
                <Trans>← Volver a iniciar sesión</Trans>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line pt-4 text-xs text-ink-3">
          <p className="whitespace-nowrap">
            <span className="font-semibold text-ink">Oranje People</span> · v{__APP_VERSION__}
          </p>
          <LanguageSwitch size="sm" />
        </div>
      </motion.section>
    </main>
  )
}
