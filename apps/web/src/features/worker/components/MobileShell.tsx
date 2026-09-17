import { Trans, useLingui } from '@lingui/react/macro'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  MaterialIcon,
} from '@oranje/ui'
import { motion, useReducedMotion } from 'framer-motion'
import { useRef, type ReactNode } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'

import { useGetMyNotificationsQuery, useGetMyProfileQuery } from '../api/workerApi'

import { PasswordOverdueScreen, ProfileOverdueScreen } from './AccessDeadlineBanner'
import { SuspendedScreen } from './TaxDeadlineBanner'

import { useAppSelector } from '@/app/hooks'
import { activateLocale, LOCALE_LABEL, LOCALES } from '@/app/i18n'
import { useLogoutMutation, useUpdateMyLocaleMutation } from '@/app/sessionApi'
import { selectSessionUser } from '@/app/sessionSlice'
import logoAnimado from '@/assets/loader/oranje-sidebar-light.lottie'
import { WORKER_ROLE } from '@/shared/constants/roles'
import { MOTION, SPRING } from '@/shared/lib/motion'

/** Webmail del buzón corporativo (cPanel de oranjepeople.com). */
const WEBMAIL_URL = 'https://webmail.oranjepeople.com/logout/?locale=en'

/** El orden de las pestañas: decide hacia dónde se desliza la pantalla al cambiar. */
const TAB_ORDER = [
  '/collaborator',
  '/collaborator/punch',
  '/collaborator/alta',
  '/collaborator/notifications',
  '/collaborator/profile',
]

/** A dónde lleva cada pestaña al deslizar (Alta siempre a su Fase 2). */
const TAB_PATH = [
  '/collaborator',
  '/collaborator/punch',
  '/collaborator/signup-2',
  '/collaborator/notifications',
  '/collaborator/profile',
]

/** Cuánto hay que arrastrar (px) o qué tan rápido (px/s) para cambiar de pestaña. */
const SWIPE_OFFSET = 72
const SWIPE_VELOCITY = 500

function tabIndexOf(pathname: string): number {
  const index = TAB_ORDER.findIndex((tab, i) =>
    i === 0 ? pathname === tab : pathname.startsWith(tab),
  )
  return index === -1 ? 0 : index
}

/**
 * El shell del apartado del Colaborador: web responsive que imita la app
 * móvil de la maqueta (columna de 390px, encabezado ORANJE + nombre corto).
 * No lleva el sidebar del staff — el Colaborador no opera ese sistema.
 * Día 5 sin SSN/ITIN: el acceso se suspende y el shell bloquea todo.
 */
export function MobileShell(): ReactNode {
  const reduceMotion = useReducedMotion() ?? false
  const user = useAppSelector(selectSessionUser)
  const location = useLocation()
  const navigate = useNavigate()
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation()
  const [updateMyLocale] = useUpdateMyLocaleMutation()
  const { t, i18n } = useLingui()

  /*
   * La dirección se decide UNA vez por cambio de ruta y se recuerda: los
   * re-renders mientras cargan los datos no deben recalcularla.
   */
  const lastPath = useRef(location.pathname)
  const lastIndex = useRef(tabIndexOf(location.pathname))
  const directionRef = useRef(1)
  if (location.pathname !== lastPath.current) {
    const nextIndex = tabIndexOf(location.pathname)
    directionRef.current = nextIndex >= lastIndex.current ? 1 : -1
    lastIndex.current = nextIndex
    lastPath.current = location.pathname
  }
  const direction = directionRef.current

  /** Deslizar con el dedo: a la izquierda avanza, a la derecha regresa; en los extremos no hay a dónde. */
  function onSwipeEnd(offsetX: number, velocityX: number): void {
    const goesNext = offsetX < -SWIPE_OFFSET || velocityX < -SWIPE_VELOCITY
    const goesPrev = offsetX > SWIPE_OFFSET || velocityX > SWIPE_VELOCITY
    const current = tabIndexOf(location.pathname)
    const target = goesNext ? current + 1 : goesPrev ? current - 1 : current
    const path = TAB_PATH[target]
    if (path !== undefined && target !== current) void navigate(path)
  }

  const isWorker = user === null || user.roleId === WORKER_ROLE
  const { data: profile } = useGetMyProfileQuery(undefined, { skip: !isWorker })
  const { data: board } = useGetMyNotificationsQuery(undefined, { skip: !isWorker })

  /** El staff no tiene expediente propio: su casa es el shell del sidebar. */
  if (!isWorker) return <Navigate to="/" replace />

  const isSuspended = profile?.taxDeadline.status === 'SUSPENDED'
  /* Los otros dos plazos (contraseña temporal, expediente a medias): vencidos
     bloquean todo menos lo que los levanta. Cambiar la contraseña va inline;
     completar los datos vive en Mis datos, así que esas dos rutas siguen
     abiertas y el resto ve el interceptor. */
  const isPasswordOverdue = profile?.accessDeadlines.password.status === 'OVERDUE'
  const isProfileOverdue =
    profile?.accessDeadlines.profile.status === 'OVERDUE' &&
    !location.pathname.startsWith('/collaborator/signup-')

  /** El contador viene del `meta.unread` del board, no de contar la página. */
  const unread = board?.unread ?? 0
  const shortName = profile
    ? `${profile.fullName.split(/\s+/)[0] ?? ''} ${profile.fullName.split(/\s+/)[1]?.charAt(0) ?? ''}.`
    : ''

  const tabClass = ({ isActive }: { isActive: boolean }): string =>
    cn(
      'relative flex min-h-10 flex-1 touch-manipulation items-center justify-center rounded-full px-2 text-xs font-semibold whitespace-nowrap transition-colors',
      isActive ? 'text-ink' : 'text-ink-3 hover:text-ink',
    )

  /** La píldora naranja es UNA y viaja entre pestañas (layoutId), con spring. */
  const tab =
    (label: ReactNode) =>
    ({ isActive }: { isActive: boolean }): ReactNode => (
      <>
        {isActive && (
          <motion.span
            layoutId="worker-tab-pill"
            aria-hidden
            className="absolute inset-0 -z-10 rounded-full bg-o-500"
            transition={reduceMotion ? { duration: 0 } : SPRING.snappy}
          />
        )}
        <span className="relative">{label}</span>
      </>
    )

  return (
    <div className="min-h-screen bg-surface-2">
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col bg-surface shadow-lg">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="w-32 aspect-[1024/100]" role="img" aria-label="Oranje">
            <DotLottieReact src={logoAnimado} loop autoplay />
          </div>
          {/* Solo el avatar: el nombre ya vive en Inicio y en Perfil. Tocar abre el menú. */}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t`Cuenta de ${shortName}`}
              className="relative flex size-11 cursor-pointer touch-manipulation items-center justify-center rounded-full transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500 data-[state=open]:bg-surface-2"
            >
              {profile?.photoUrl ? (
                <img src={profile.photoUrl} alt="" className="size-9 rounded-full object-cover" />
              ) : (
                <span
                  aria-hidden
                  className="flex size-9 items-center justify-center rounded-full bg-o-500 text-sm font-bold text-ink"
                >
                  {profile?.fullName.charAt(0) ?? '·'}
                </span>
              )}
              {/* La flecha dice «esto se abre»: sin ella el avatar parece un adorno. */}
              <span
                aria-hidden
                className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full border border-line bg-surface text-ink-2 shadow-sm"
              >
                <MaterialIcon name="expand_more" className="text-[14px] leading-none" />
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem
                onSelect={() => {
                  void navigate('/collaborator/profile')
                }}
              >
                <MaterialIcon name="person" className="text-lg" aria-hidden />
                <Trans>Mi Perfil</Trans>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  void navigate('/collaborator/password')
                }}
              >
                <MaterialIcon name="password" className="text-lg" aria-hidden />
                <Trans>Contraseña</Trans>
              </DropdownMenuItem>
              {/* El buzón @oranjepeople.com vive en el webmail de cPanel, fuera
                  de la app; se abre en pestaña nueva y en la pantalla de entrar
                  (la ruta /logout la muestra limpia aunque haya otra sesión). */}
              <DropdownMenuItem
                onSelect={() => {
                  window.open(WEBMAIL_URL, '_blank', 'noopener')
                }}
              >
                <MaterialIcon name="mail" className="text-lg" aria-hidden />
                <Trans>Mi correo</Trans>
                <MaterialIcon
                  name="open_in_new"
                  className="ml-auto text-base text-ink-3"
                  aria-hidden
                />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* Idioma junto a la cuenta (D-36): cada idioma en su propio idioma, sin banderas. */}
              {LOCALES.map((locale) => (
                <DropdownMenuItem
                  key={locale}
                  lang={locale}
                  aria-current={i18n.locale === locale ? 'true' : undefined}
                  onSelect={() => {
                    if (i18n.locale === locale) return
                    activateLocale(locale)
                    void updateMyLocale(locale)
                  }}
                >
                  <MaterialIcon
                    name={
                      i18n.locale === locale ? 'radio_button_checked' : 'radio_button_unchecked'
                    }
                    className="text-lg"
                    aria-hidden
                  />
                  {LOCALE_LABEL[locale]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={isLoggingOut}
                onSelect={() => {
                  void logout()
                }}
              >
                <MaterialIcon name="logout" className="text-lg" aria-hidden />
                <Trans>Cerrar sesión</Trans>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <nav
          aria-label={t`Secciones`}
          className="isolate flex gap-1 border-b border-line px-4 py-2.5"
        >
          <NavLink to="/collaborator" end className={tabClass}>
            {tab(t`Inicio`)}
          </NavLink>
          <NavLink to="/collaborator/punch" className={tabClass}>
            {tab(t`Ponchar`)}
          </NavLink>
          <NavLink to="/collaborator/signup-2" className={tabClass}>
            {tab(t`Mis datos`)}
          </NavLink>
          <NavLink to="/collaborator/notifications" className={tabClass}>
            {tab(unread > 0 ? t`Avisos · ${unread}` : t`Avisos`)}
          </NavLink>
          <NavLink to="/collaborator/profile" className={tabClass}>
            {tab(t`Perfil`)}
          </NavLink>
        </nav>

        {/*
         * Cambiar de pestaña: UN solo movimiento. La pantalla anterior se va
         * al instante y la nueva entra deslizando 24 px hacia donde navegas;
         * nunca dos pantallas a la vez ni fundido previo. Y se puede deslizar
         * con el dedo: el arrastre horizontal sigue al dedo (con tope
         * elástico) y al soltar decide; el vertical sigue siendo scroll.
         */}
        <main className="flex-1 overflow-x-clip px-5 py-5">
          {isSuspended ? (
            <SuspendedScreen />
          ) : isPasswordOverdue ? (
            <PasswordOverdueScreen />
          ) : isProfileOverdue ? (
            <ProfileOverdueScreen />
          ) : (
            <motion.div
              key={location.pathname}
              initial={reduceMotion ? false : { opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: MOTION.enter, ease: [...MOTION.easeOut] }}
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              dragTransition={{ bounceStiffness: 420, bounceDamping: 38 }}
              onDragEnd={(_event, info) => {
                onSwipeEnd(info.offset.x, info.velocity.x)
              }}
              className="touch-pan-y"
            >
              <Outlet />
            </motion.div>
          )}
        </main>
      </div>
    </div>
  )
}
