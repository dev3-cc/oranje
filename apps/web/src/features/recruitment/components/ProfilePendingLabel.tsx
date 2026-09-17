import { Trans } from '@lingui/react/macro'
import type { ReactNode } from 'react'

import { formatDate } from '@/shared/lib/formatters'

/**
 * «Perfil incompleto» a secas es un Blanco normal. Con `dueAt` es un
 * colaborador validado a medias (Reglas de Negocio § Validación con
 * expediente incompleto): la etiqueta dice hasta cuándo, o que ya venció y
 * su acceso está bloqueado hasta que lo complete.
 */
export function ProfilePendingLabel({ dueAt }: { dueAt: string | null }): ReactNode {
  if (dueAt === null) {
    return <Trans>Perfil incompleto</Trans>
  }

  if (new Date(dueAt).getTime() < Date.now()) {
    return <Trans>Perfil incompleto · venció, acceso bloqueado</Trans>
  }

  const date = formatDate(dueAt)

  return <Trans>Perfil incompleto · hasta el {date}</Trans>
}
