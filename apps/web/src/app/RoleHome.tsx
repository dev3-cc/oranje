import type { ReactNode } from 'react'
import { Navigate } from 'react-router'

import { useAppSelector } from './hooks'
import { selectSessionUser } from './sessionSlice'

import { WORKER_ROLE } from '@/shared/constants/roles'

/**
 * El `/` de cada rol: el Colaborador (ROL-C-01) vive en `/colaborador`, el
 * staff arranca en el Dashboard. Sin usuario todavía no se decide (el guard
 * de sesión ya está resolviendo arriba).
 */
export function RoleHome(): ReactNode {
  const user = useAppSelector(selectSessionUser)
  if (!user) return null
  return <Navigate to={user.roleId === WORKER_ROLE ? '/colaborador' : '/dashboard'} replace />
}
