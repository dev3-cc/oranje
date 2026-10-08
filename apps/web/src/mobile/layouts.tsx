import { Toaster } from '@oranje/ui'
import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router'

import { homePathFor, isHotelRole } from './roles'

import { useAppSelector } from '@/app/hooks'
import { selectSessionUser } from '@/app/sessionSlice'

/**
 * La puerta del apartado del hotel: Supervisor, Manager de Área y Manager
 * General ven el shell del web tal cual; cualquier otro rol vuelve a su
 * apartado (el resto del staff trabaja en el web, no en la app).
 */
export function HotelOnly(): ReactNode {
  const user = useAppSelector(selectSessionUser)
  if (!user) return null
  if (!isHotelRole(user.roleId)) return <Navigate to={homePathFor(user.roleId)} replace />
  return <Outlet />
}

/**
 * Los avisos (`toast`) de lo que NO monta el `AppShell` del web: el login, el
 * Colaborador y la pantalla de rol sin app. El shell del hotel trae su propio
 * `Toaster`; montarlo dos veces duplicaba cada aviso.
 */
export function WithToaster(): ReactNode {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  )
}
