import { zodResolver } from '@hookform/resolvers/zod'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { Input } from '@oranje/ui'
import { AnimatePresence, motion } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'

import { LoginScene } from '../components/LoginScene'
import { loginSchema, type LoginFormValues } from '../types/login.schema'

import { useAppSelector } from '@/app/hooks'
import { useCreateSessionMutation } from '@/app/sessionApi'
import { selectSessionStatus } from '@/app/sessionSlice'
import logoAnimado from '@/assets/loader/oranje-sidebar-light.lottie'
import { requestPasswordReset, signInWithEmail } from '@/shared/lib/firebase'

/**
 * Login — la única pantalla pública. Layout partido como la referencia de
 * diseño: formulario a la izquierda (340–400px) y panel visual a la derecha,
 * que en móvil desaparece para dejar solo la tarjeta del formulario. Detrás,
 * un collage de hoteles con velo cálido.
 *
 * El botón primario va con texto `--ink` sobre naranja: blanco da 2.5:1 y la
 * regla de contraste de `tokens.ts` lo prohíbe (la excepción documentada en
 * `Button.tsx` es deuda de la maqueta, no un precedente).
 */

/**
 * Hoteles de Estados Unidos para el fondo. Fotos de Unsplash serviéndose de su
 * CDN (hotlink permitido por su licencia). Son decorativas: si alguna cae, el
 * velo y el color de fondo cubren el hueco sin romper nada.
 *
 * ⚠ Si algún día el web sirve con CSP, `images.unsplash.com` necesita entrar
 * a `img-src` (la CSP de D-17 solo abre `maps.googleapis.com`).
 */
const HOTEL_PHOTOS: readonly string[] = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=640&q=55',
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=640&q=55',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=640&q=55',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=640&q=55',
  'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=640&q=55',
  'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=640&q=55',
  'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=640&q=55',
  'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=640&q=55',
]

/**
 * Collage de fondo con paneo lento. Decorativo: `aria-hidden`, sin foco.
 *
 * El bucle solo es continuo si el `-50%` del paneo cae EXACTO donde empieza
 * una copia idéntica: por eso son DOS bloques iguales apilados, y cada bloque
 * repite las fotos hasta medir más que cualquier pantalla — sin eso, en
 * monitores altos el collage se acababa y subía un hueco vacío.
 */
const BACKDROP_REPEATS = 6

function HotelBackdrop(): ReactNode {
  const block = Array.from({ length: BACKDROP_REPEATS }, () => HOTEL_PHOTOS).flat()

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <motion.div
        animate={{ y: ['0%', '-50%'] }}
        transition={{ duration: 240, repeat: Infinity, ease: 'linear' }}
        className="flex flex-col"
      >
        {[0, 1].map((copy) => (
          <div
            key={copy}
            className="grid grid-cols-2 gap-3 px-3 py-1.5 sm:grid-cols-3 lg:grid-cols-4"
          >
            {block.map((src, index) => (
              <img
                key={`${String(copy)}-${src}-${String(index)}`}
                src={src}
                alt=""
                loading="lazy"
                className="h-44 w-full rounded-lg object-cover sm:h-52"
              />
            ))}
          </div>
        ))}
      </motion.div>
      {/* Velo cálido: el fondo acompaña, la tarjeta manda. */}
      <div className="absolute inset-0 bg-gradient-to-b from-surface-2/85 via-surface-2/70 to-surface-2/90 backdrop-blur-[2px]" />
    </div>
  )
}

/** Un solo mensaje para credenciales malas: no se revela cuál mitad falló. */
function loginErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null
      ? ((error as { data?: { error?: { code?: string } } }).data?.error?.code ?? '')
      : ''
  if (code === 'LOGIN_NOT_CONFIGURED') {
    return 'Este ambiente no tiene el login configurado. Avisa al administrador.'
  }
  if (code === 'USER_NOT_REGISTERED' || code === 'USER_INACTIVE') {
    return 'Tu cuenta no está activa en Oranje. Avisa al administrador.'
  }
  return 'No se pudo iniciar sesión. Revisa tu correo y contraseña.'
}

type AuthMode = 'login' | 'reset'

export function LoginPage(): ReactNode {
  const status = useAppSelector(selectSessionStatus)
  const navigate = useNavigate()
  const location = useLocation()
  const [createSession] = useCreateSessionMutation()
  const [mode, setMode] = useState<AuthMode>('login')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [resetSentTo, setResetSentTo] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  /** Con sesión viva no hay nada que hacer aquí. */
  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function onSubmit(values: LoginFormValues): Promise<void> {
    setSubmitError(null)
    try {
      /** Firebase autentica (D-05); la API canjea el idToken por LA sesión. */
      const idToken = await signInWithEmail(values.email, values.password)
      await createSession({ idToken }).unwrap()
      const from = (location.state as { from?: string } | null)?.from ?? '/'
      void navigate(from, { replace: true })
    } catch (error) {
      setSubmitError(loginErrorMessage(error))
    }
  }

  /**
   * Recuperación: Firebase manda el correo con el enlace, sin tocar la API
   * (la contraseña vive en Firebase, D-05). La respuesta es la MISMA exista o
   * no la cuenta: no se confirma qué correos están registrados.
   */
  async function onRequestReset(): Promise<void> {
    const email = getValues('email').trim()
    if (!email) {
      setSubmitError('Escribe tu correo para mandarte el enlace.')
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
    <main className="relative flex min-h-screen items-center justify-center bg-surface-2 p-4 sm:p-6">
      <HotelBackdrop />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex w-full max-w-4xl overflow-hidden rounded-2xl border border-line bg-surface shadow-xl"
      >
        {/* Columna del formulario: 340–400px, como la referencia. */}
        <section className="flex w-full flex-col justify-center gap-8 p-8 sm:p-10 md:max-w-100">
          <motion.div
            role="img"
            aria-label="Oranje"
            className="h-6 aspect-[1024/120] self-start"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <DotLottieReact src={logoAnimado} loop autoplay />
          </motion.div>

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
                  <h1 className="text-2xl font-bold text-ink">Inicia sesión</h1>
                  <p className="text-sm text-ink-3">La operación de tu hotel, en un solo lugar.</p>
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
                      Correo
                    </label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="tu@oranje.mx"
                      className="h-auto px-4 py-3"
                      {...register('email')}
                    />
                    {errors.email && <p className="text-sm text-red">{errors.email.message}</p>}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="password" className="text-sm font-medium text-ink-2">
                        Contraseña
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitError(null)
                          setResetSentTo(null)
                          setMode('reset')
                        }}
                        className="text-xs font-semibold text-o-700 hover:underline"
                      >
                        ¿La olvidaste?
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
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-3 hover:text-ink"
                        aria-label={isPasswordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        <span className="material-icons-outlined text-xl leading-none" aria-hidden>
                          {isPasswordVisible ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-sm text-red">{errors.password.message}</p>
                    )}
                  </div>

                  {submitError && (
                    <motion.p
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      role="alert"
                      className="rounded-md bg-surface-2 p-3 text-sm text-red"
                    >
                      {submitError}
                    </motion.p>
                  )}

                  <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    whileHover={{ scale: isSubmitting ? 1 : 1.015 }}
                    whileTap={{ scale: isSubmitting ? 1 : 0.985 }}
                    className="rounded-md bg-o-500 px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-o-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? 'Entrando…' : 'Entrar'}
                  </motion.button>
                </form>

                <p className="text-xs text-ink-4">
                  ¿Sin acceso? El alta de usuarios la hace el administrador de tu departamento.
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
                  <h1 className="text-2xl font-bold text-ink">Recupera tu contraseña</h1>
                  <p className="text-sm text-ink-3">
                    Te mandamos un enlace al correo para crear una nueva.
                  </p>
                </div>

                {resetSentTo ? (
                  <p className="rounded-md bg-surface-2 p-4 text-sm text-ink-2">
                    Si <span className="font-semibold">{resetSentTo}</span> está registrado en
                    Oranje, el enlace ya va en camino. Revisa también el spam.
                  </p>
                ) : (
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="email" className="text-sm font-medium text-ink-2">
                        Correo
                      </label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="tu@oranje.mx"
                        className="h-auto px-4 py-3"
                        {...register('email')}
                      />
                    </div>

                    {submitError && (
                      <p role="alert" className="rounded-md bg-surface-2 p-3 text-sm text-red">
                        {submitError}
                      </p>
                    )}

                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => {
                        void onRequestReset()
                      }}
                      className="rounded-md bg-o-500 px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-o-700"
                    >
                      Mandar enlace
                    </motion.button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSubmitError(null)
                    setMode('login')
                  }}
                  className="self-start text-sm font-semibold text-o-700 hover:underline"
                >
                  ← Volver a iniciar sesión
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Panel visual: las naranjas de la marca, en 3D. */}
        <motion.aside
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="relative m-3 hidden flex-1 overflow-hidden rounded-xl bg-gradient-to-br from-o-500 to-o-700 md:block"
        >
          <LoginScene />
          <div className="absolute inset-x-4 bottom-4 rounded-lg bg-surface/90 p-4 backdrop-blur">
            <p className="text-sm font-semibold text-ink">
              Nuevo Oranje <span className="font-normal text-ink-3">· v{__APP_VERSION__}</span>
            </p>
            <p className="text-xs text-ink-3">
              Staffing de hoteles: del reclutamiento al pago, con un semáforo en cada paso.
            </p>
          </div>
        </motion.aside>
      </motion.div>
    </main>
  )
}
