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
  { status: 'GRAY', label: 'Identificado' },
  { status: 'LIGHT_BLUE', label: 'En contacto' },
  { status: 'GREEN', label: 'Propuesta' },
  { status: 'ORANGE', label: 'Cliente' },
  { status: 'RED', label: 'Rechazo' },
]

export function TerritoryMapLegend({
  isBehindCard = false,
}: {
  isBehindCard?: boolean
}): ReactNode {
  return (
    /* En móvil la hoja del hotel ocupa el pie del mapa: la leyenda se cede. */
    <ul
      className={`absolute bottom-3 left-3 z-10 flex-wrap items-center gap-2.5 rounded-full bg-surface/95 px-4 py-2 shadow-md sm:bottom-6 sm:left-6 sm:flex sm:gap-4 sm:px-5 sm:py-2.5 ${
        isBehindCard ? 'hidden' : 'flex'
      }`}
    >
      {LEGEND_ITEMS.map((item) => (
        <li
          key={item.status}
          className="flex items-center gap-1.5 text-xs text-ink-2 sm:gap-2 sm:text-sm"
        >
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
