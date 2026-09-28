import { useEffect, useRef, type ReactNode } from 'react'
import { Outlet } from 'react-router'

import { useAppSelector } from '@/app/hooks'
import { selectSessionStatus } from '@/app/sessionSlice'
import { hasNativePermissions, usePermissionsScreen } from '@/features/worker'

/**
 * Lo primero que ve el Colaborador en la app al quedar con sesión —después del
 * login o al abrir la app con la sesión viva— es la pantalla NATIVA de
 * Permisos. Una vez por sesión: el refresh de cada 15 minutos vuelve a dejar
 * la sesión en `authenticated` sin pasar por `anonymous`, así que no la
 * reabre; cerrar sesión sí la rearma para el siguiente login.
 *
 * Es la raíz del router móvil (una ruta de layout, sin `path`), FUERA de
 * `RequireSession`: tiene que ver la sesión caer a `anonymous` para rearmarse,
 * y dentro del guard ya no existiría en ese momento.
 */
export function PermissionsOnLaunch(): ReactNode {
  const status = useAppSelector(selectSessionStatus)
  const openPermissions = usePermissionsScreen()
  const hasShown = useRef(false)

  useEffect(() => {
    if (status === 'anonymous') hasShown.current = false
    if (status !== 'authenticated' || hasShown.current || !hasNativePermissions()) return
    hasShown.current = true
    void openPermissions()
  }, [status, openPermissions])

  return <Outlet />
}
