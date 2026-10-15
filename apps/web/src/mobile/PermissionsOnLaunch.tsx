import { useLingui } from '@lingui/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Outlet } from 'react-router'

import { hasHotelPermissionsScreen, useHotelPermissionsScreen } from './hotelPermissions'
import { isHotelRole, isWorkerRole } from './roles'

import { useAppSelector } from '@/app/hooks'
import { useGetSessionQuery } from '@/app/sessionApi'
import { selectSessionStatus, selectSessionUser } from '@/app/sessionSlice'
import { hasNativePermissions, usePermissionsScreen } from '@/features/worker'

/**
 * Lo primero que se ve en la app al quedar con sesión —después del login o al
 * abrir la app con la sesión viva— es la pantalla NATIVA de Permisos, en el
 * perfil de cada rol:
 *
 *   Colaborador  ubicación, GPS y cámara, con «Ponchar».
 *   Hotel        notificaciones, con «Continuar». Nunca bloquea.
 *
 * Cualquier otro rol no ve ninguna: su pantalla es la que le dice que esta
 * app no es para él.
 *
 * Espera a `/me`: ahí viene el idioma GUARDADO en la persona (D-36), que gana
 * sobre el del teléfono. Abrirla antes la pintaba en el idioma del teléfono y,
 * un instante después, la app cambiaba al de la persona: la pantalla nativa en
 * inglés y el Inicio en español.
 *
 * Una vez por sesión: el refresh de cada 15 minutos vuelve a dejar la sesión
 * en `authenticated` sin pasar por `anonymous`, así que no la reabre; cerrar
 * sesión sí la rearma para el siguiente login.
 *
 * Es la raíz del router móvil (una ruta de layout, sin `path`), FUERA de
 * `RequireSession`: tiene que ver la sesión caer a `anonymous` para rearmarse,
 * y dentro del guard ya no existiría en ese momento.
 */
export function PermissionsOnLaunch(): ReactNode {
  const status = useAppSelector(selectSessionStatus)
  const roleId = useAppSelector(selectSessionUser)?.roleId
  const isAuthenticated = status === 'authenticated'
  const { data: me, isError: meFailed } = useGetSessionQuery(undefined, { skip: !isAuthenticated })
  const { i18n } = useLingui()
  const openWorkerPermissions = usePermissionsScreen()
  const openHotelPermissions = useHotelPermissionsScreen()
  const hasShown = useRef(false)

  /* Listo para abrir: con el idioma de la persona ya aplicado (o sin `/me`, con el que haya). */
  const localeReady = meFailed || (me !== undefined && i18n.locale === me.locale)

  useEffect(() => {
    if (status === 'anonymous') hasShown.current = false
    if (!isAuthenticated || !localeReady || hasShown.current) return
    if (isWorkerRole(roleId) && hasNativePermissions()) {
      hasShown.current = true
      void openWorkerPermissions()
    } else if (isHotelRole(roleId) && hasHotelPermissionsScreen()) {
      hasShown.current = true
      void openHotelPermissions()
    }
  }, [status, isAuthenticated, localeReady, roleId, openWorkerPermissions, openHotelPermissions])

  return <Outlet />
}
