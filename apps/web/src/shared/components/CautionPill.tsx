import { MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'

/**
 * Una precaución que habla en voz baja: tinte amarillo (el color de
 * «atención» del sistema) con icono de LÍNEA — mismo peso que los iconos
 * informativos de al lado — y el texto en tinta, que es lo que se lee. El
 * triángulo relleno gritaba como error y se salía del set de iconos.
 * El color nunca va solo: icono + palabras.
 */
export function CautionPill({ children }: { children: ReactNode }): ReactNode {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow/20 py-0.5 pr-2.5 pl-2 text-xs font-medium text-ink-2">
      <MaterialIcon name="warning_amber" className="text-sm text-ink-2" aria-hidden />
      {children}
    </span>
  )
}
