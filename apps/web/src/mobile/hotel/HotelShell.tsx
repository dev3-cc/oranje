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
import type { ReactNode } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router'

import { homePathFor, isHotelRole } from '../roles'

import { hasHotelPermissionsScreen, useHotelPermissionsScreen } from './hotelPermissions'

import { useAppSelector } from '@/app/hooks'
import { activateLocale, LOCALE_LABEL, LOCALES } from '@/app/i18n'
import { useGetSessionQuery, useLogoutMutation, useUpdateMyLocaleMutation } from '@/app/sessionApi'
import { selectSessionUser } from '@/app/sessionSlice'
import logoAnimado from '@/assets/loader/oranje-sidebar-light.lottie'
import { useCan } from '@/shared/hooks/useCan'

/**
 * El apartado del hotel en la app (Supervisor, Manager de Área y Manager
 * General): el mismo lenguaje que el del Colaborador —columna de 420 px,
 * encabezado con el logo y el avatar que abre el menú, pestañas debajo— para
 * que la app se sienta una sola.
 *
 * Las pestañas crecen con cada fase (Requisiciones, Timesheet, Mi personal…);
 * cada una se pinta según los permisos que devuelve `/me`, igual que en el web.
 */
export function HotelShell(): ReactNode {
  const { t, i18n } = useLingui()
  const user = useAppSelector(selectSessionUser)
  const { data: session } = useGetSessionQuery()
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation()
  const [updateMyLocale] = useUpdateMyLocaleMutation()
  const openPermissions = useHotelPermissionsScreen()
  const can = useCan()
  const navigate = useNavigate()

  /* Quien no es del hotel no se queda aquí: a su apartado. */
  if (!isHotelRole(user?.roleId)) return <Navigate to={homePathFor(user?.roleId)} replace />

  const name = session?.name ?? user?.name ?? ''
  /* Mismo nombre de variable que el shell del Colaborador: comparte su traducción. */
  const shortName = session?.shortName ?? user?.shortName ?? name
  const photoUrl = session?.photoUrl ?? null
  const canOpenPermissions = hasHotelPermissionsScreen()

  /*
   * Las pestañas del apartado. Crecen con cada fase; con UNA sola no se pinta
   * la barra: una píldora naranja a todo lo ancho parece un botón, no una
   * navegación.
   */
  const tabs: Array<{ to: string; label: string; end: boolean }> = [
    { to: '/hotel', label: t`Inicio`, end: true },
    { to: '/hotel/requisitions', label: t`Requisiciones`, end: false },
    ...(can('timesheet:read_department') || can('timesheet:read_all')
      ? [{ to: '/hotel/timesheet', label: t`Timesheet`, end: false }]
      : []),
    ...(can('staff:read') ? [{ to: '/hotel/staff', label: t`Mi personal`, end: false }] : []),
  ]

  const tabClass = ({ isActive }: { isActive: boolean }): string =>
    cn(
      'relative flex min-h-10 flex-1 touch-manipulation items-center justify-center rounded-full px-2 text-xs font-semibold whitespace-nowrap transition-colors',
      isActive ? 'bg-o-500 text-ink' : 'text-ink-3',
    )

  return (
    <div className="min-h-screen bg-surface-2">
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col bg-surface shadow-lg">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="w-32 aspect-[1024/100]" role="img" aria-label="Oranje">
            <DotLottieReact src={logoAnimado} loop autoplay />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t`Cuenta de ${shortName}`}
              className="relative flex size-11 cursor-pointer touch-manipulation items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500 data-[state=open]:bg-surface-2"
            >
              {photoUrl ? (
                <img src={photoUrl} alt="" className="size-9 rounded-full object-cover" />
              ) : (
                <span
                  aria-hidden
                  className="flex size-9 items-center justify-center rounded-full bg-o-500 text-sm font-bold text-ink"
                >
                  {name.charAt(0) || '·'}
                </span>
              )}
              <span
                aria-hidden
                className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full border border-line bg-surface text-ink-2 shadow-sm"
              >
                <MaterialIcon name="expand_more" className="text-[14px] leading-none" />
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              {/* Permisos y su separador van juntos: sin la opción (fuera de la
                  app) el menú no arranca con una raya suelta. */}
              {canOpenPermissions && (
                <>
                  <DropdownMenuItem
                    onSelect={() => {
                      void openPermissions()
                    }}
                  >
                    <MaterialIcon name="notifications" className="text-lg" aria-hidden />
                    <Trans>Permisos</Trans>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {(can('dashboard:read_all') || can('dashboard:read_department')) && (
                <DropdownMenuItem
                  onSelect={() => {
                    void navigate('/hotel/costs')
                  }}
                >
                  <MaterialIcon name="payments" className="text-lg" aria-hidden />
                  <Trans>Costos</Trans>
                </DropdownMenuItem>
              )}
              {can('hotel:punch_qr') && (
                <>
                  <DropdownMenuItem
                    onSelect={() => {
                      void navigate('/hotel/punch-qr')
                    }}
                  >
                    <MaterialIcon name="qr_code_2" className="text-lg" aria-hidden />
                    <Trans>QR de ponche</Trans>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
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

        {tabs.length > 1 && (
          <nav aria-label={t`Secciones`} className="flex gap-1 border-b border-line px-4 py-2.5">
            {tabs.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end={tab.end} className={tabClass}>
                {tab.label}
              </NavLink>
            ))}
          </nav>
        )}

        <main className="flex-1 px-5 py-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
