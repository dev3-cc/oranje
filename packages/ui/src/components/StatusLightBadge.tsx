import { cn } from '@ui/lib/utils'
import type { ReactNode } from 'react'

import { statusLight, statusLightForeground, type StatusLightToken } from '../../tokens'

/**
 * Chip de semáforo. No tiene equivalente en shadcn ni en react-native-reusables:
 * es una composición Oranje (D-16).
 *
 * Sirve a los 7 semáforos — un color se ve igual en todos, lo que cambia es qué
 * significa en cada uno. Por eso recibe `label`: el nombre del estado lo pone
 * quien lo usa, no este componente.
 */
export interface StatusLightBadgeProps {
  token: StatusLightToken
  label: string
  className?: string
}

export function StatusLightBadge({ token, label, className }: StatusLightBadgeProps): ReactNode {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        // Blanco se pierde sobre --surface: lleva borde
        token === 'st-blanco' && 'border border-line',
        className,
      )}
      style={{
        backgroundColor: statusLight[token],
        color: statusLightForeground[token],
      }}
    >
      {label}
    </span>
  )
}
