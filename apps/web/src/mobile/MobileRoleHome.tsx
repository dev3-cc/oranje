import type { ReactNode } from 'react'
import { Navigate } from 'react-router'

import { homePathFor } from './roles'

import { useAppSelector } from '@/app/hooks'
import { selectSessionUser } from '@/app/sessionSlice'

/**
 * `/` de la app: manda a cada quien a su apartado según su rol. Vive DENTRO de
 * `RequireSession`, así que aquí ya hay sesión — sin ella, el guard manda al
 * login antes de llegar.
 *
 * Es el `RoleHome` del web en versión app: aquel manda al staff a
 * `/dashboard`, que en la app no existe.
 */
export function MobileRoleHome(): ReactNode {
  const user = useAppSelector(selectSessionUser)
  return <Navigate to={homePathFor(user?.roleId)} replace />
}
