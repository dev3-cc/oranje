import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { TerritoryZone } from '../types/territory.types'

/**
 * Filtro por zona. «Todas» es una opción más y no un botón aparte: seleccionar
 * zona es una sola decisión, y el total vive en el mismo renglón que las partes.
 */
export function TerritoryZoneChips({
  zones,
  total,
  selectedZoneId,
  onSelect,
}: {
  zones: TerritoryZone[]
  total: number
  selectedZoneId: string | null
  onSelect: (zoneId: string | null) => void
}): ReactNode {
  const options: { id: string | null; label: string; count: number }[] = [
    { id: null, label: 'Todas', count: total },
    ...zones.map((zone) => ({ id: zone.id, label: zone.label, count: zone.count })),
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isActive = option.id === selectedZoneId

        return (
          <button
            key={option.label}
            type="button"
            aria-pressed={isActive}
            onClick={() => {
              onSelect(option.id)
            }}
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors',
              isActive
                ? 'border-o-500 bg-o-500 font-semibold text-white'
                : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
            )}
          >
            {option.label}
            <span className={isActive ? 'text-white/75' : 'text-ink-4'}>{option.count}</span>
          </button>
        )
      })}
    </div>
  )
}
