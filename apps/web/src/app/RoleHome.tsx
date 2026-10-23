import type { ReactNode } from 'react'
import { Navigate } from 'react-router'

import { useAppSelector } from './hooks'
import { selectSessionUser } from './sessionSlice'

import { ACCOUNTING_ROLES, WORKER_ROLE } from '@/shared/constants/roles'

/**
 * El `/` de cada rol: el Colaborador (ROL-C-01) vive en `/collaborator`, el
 * staff arranca en el Dashboard. Sin usuario todavía no se decide (el guard
 * de sesión ya está resolviendo arriba).
 */
export function RoleHome(): ReactNode {
  const user = useAppSelector(selectSessionUser)
  if (!user) return null
  if (user.roleId === WORKER_ROLE) return <Navigate to="/collaborator" replace />
  if (ACCOUNTING_ROLES.includes(user.roleId)) {
    return <Navigate to="/accounting/consolidations" replace />
  }
  return <Navigate to="/dashboard" replace />
}
