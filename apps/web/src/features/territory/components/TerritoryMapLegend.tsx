import { statusLight } from '@oranje/ui'
import type { ReactNode } from 'react'

import { ONBOARDING_STATUS_TOKEN, type OnboardingStatus } from '@/shared/constants/onboardingStatus'

/**
 * Leyenda del mapa: las cinco etapas que el diseño nombra.
 *
 * ⚠ Es un resumen, no la lista completa. El semáforo tiene ocho estados y los
 * puntos del mapa usan el color real de cada uno, así que en el mapa pueden
 * verse rosa (Rosa), amarillo (Amarillo) y café (Cafe) sin fila en la leyenda.
 * Se replicó tal cual está en la captura; si se quiere que la leyenda cubra los
 * ocho, es agregar tres filas aquí.
 */
const LEGEND_ITEMS: { status: OnboardingStatus; label: string }[] = [
  { status: 'GRIS', label: 'Identificado' },
  { status: 'AZUL_CLARO', label: 'En contacto' },
  { status: 'VERDE', label: 'Propuesta' },
  { status: 'NARANJA', label: 'Cliente' },
  { status: 'ROJO', label: 'Rechazo' },
]

export function TerritoryMapLegend(): ReactNode {
  return (
    <ul className="absolute bottom-6 left-6 z-10 flex flex-wrap items-center gap-4 rounded-full bg-surface/95 px-5 py-2.5 shadow-md">
      {LEGEND_ITEMS.map((item) => (
        <li key={item.status} className="flex items-center gap-2 text-sm text-ink-2">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: statusLight[ONBOARDING_STATUS_TOKEN[item.status]] }}
            aria-hidden
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
