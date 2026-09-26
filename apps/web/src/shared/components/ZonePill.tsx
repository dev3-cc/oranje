import { MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'

/**
 * Una zona geográfica asignada, como pastilla — mismo lenguaje que
 * `CautionPill` (icono + tinte + texto, el color nunca va solo), pero en el
 * tinte de marca: no es una advertencia, es el alcance de la persona.
 */
export function ZonePill({ children }: { children: ReactNode }): ReactNode {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-o-500/15 py-1 pr-3 pl-2.5 text-sm font-semibold text-o-700">
      <MaterialIcon name="location_on" className="text-base" aria-hidden />
      {children}
    </span>
  )
}
