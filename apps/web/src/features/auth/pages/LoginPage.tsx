import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'

import { LoginScene } from '../components/LoginScene'
import { loginSchema, type LoginFormValues } from '../types/login.schema'

import { useAppSelector } from '@/app/hooks'
import { useCreateSessionMutation } from '@/app/sessionApi'
import { selectSessionStatus } from '@/app/sessionSlice'
import logoOranje from '@/assets/logo/Logo_ORANJE_Orange.png'
import { signInWithEmail } from '@/shared/lib/firebase'

/**
 * Login — la única pantalla pública. Layout partido como la referencia de
 * diseño: formulario a la izquierda (340–400px) y panel visual a la derecha,
 * que en móvil desaparece para dejar solo la tarjeta del formulario.
 *
 * El botón primario va con texto `--ink` sobre naranja: blanco da 2.5:1 y la
 * regla de contraste de `tokens.ts` lo prohíbe (la excepción documentada en
 * `Button.tsx` es deuda de la maqueta, no un precedente).
 */

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

const INPUT_CLASS =
  'w-full rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none'

export function LoginPage(): ReactNode {
  const status = useAppSelector(selectSessionStatus)
  const navigate = useNavigate()
  const location = useLocation()
  const [createSession] = useCreateSessionMutation()
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-2 p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex w-full max-w-4xl overflow-hidden rounded-2xl border border-line bg-surface shadow-xl"
      >
        {/* Columna del formulario: 340–400px, como la referencia. */}
        <section className="flex w-full flex-col justify-center gap-8 p-8 sm:p-10 md:max-w-100">
          <motion.img
            src={logoOranje}
            alt="Oranje"
            className="h-5 w-auto self-start"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="flex flex-col gap-2"
          >
            <h1 className="text-2xl font-bold text-ink">Inicia sesión</h1>
            <p className="text-sm text-ink-3">La operación de tu hotel, en un solo lugar.</p>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
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
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="tu@oranje.mx"
                className={INPUT_CLASS}
                {...register('email')}
              />
              {errors.email && <p className="text-sm text-red">{errors.email.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-ink-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={isPasswordVisible ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`${INPUT_CLASS} pr-12`}
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
              {errors.password && <p className="text-sm text-red">{errors.password.message}</p>}
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
          </motion.form>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="text-xs text-ink-4"
          >
            ¿Sin acceso? El alta de usuarios la hace el administrador de tu departamento.
          </motion.p>
        </section>

        {/* Panel visual: la fotografía de la referencia, aquí en 3D de marca. */}
        <motion.aside
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="relative m-3 hidden flex-1 overflow-hidden rounded-xl bg-gradient-to-br from-o-500 to-o-700 md:block"
        >
          <LoginScene />
          <div className="absolute inset-x-4 bottom-4 rounded-lg bg-surface/90 p-4 backdrop-blur">
            <p className="text-sm font-semibold text-ink">Oranje Matrix System</p>
            <p className="text-xs text-ink-3">
              Staffing de hoteles: del reclutamiento al pago, con un semáforo en cada paso.
            </p>
          </div>
        </motion.aside>
      </motion.div>
    </main>
  )
}
