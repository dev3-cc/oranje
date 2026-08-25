import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { AuthorizationRequest } from '../types/requisition.types'

import { SectionCard } from '@/shared/components/SectionCard'

/** `2 pos · 2 slots`, con el singular donde toca. */
function describeSize(request: AuthorizationRequest): string {
  const slots = request.slotCount === 1 ? '1 slot' : `${String(request.slotCount)} slots`
  return `${request.department} · ${String(request.positionCount)} pos · ${slots}`
}

function describeStart(days: number): string {
  if (days === 0) return 'Inicia hoy'
  return days === 1 ? 'Inicia en 1 día' : `Inicia en ${String(days)} días`
}

/**
 * La cola de lo que espera firma.
 *
 * Cada renglón es un `<button>`: elegir a quién firmar es una acción dentro de
 * la pantalla, no un lugar distinto, así que no es un enlace y no cambia la URL.
 */
export function AuthorizationQueueList({
  items,
  selectedId,
  onSelect,
}: {
  items: AuthorizationRequest[]
  selectedId: string
  onSelect: (requisitionId: string) => void
}): ReactNode {
  return (
    <SectionCard title="Pendientes" subtitle="Ordenadas por fecha de inicio más próxima">
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-3">
          No queda nada esperando tu firma.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const isSelected = item.id === selectedId

            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={isSelected ? 'true' : undefined}
                  onClick={() => {
                    onSelect(item.id)
                  }}
                  className={cn(
                    'w-full rounded-lg border px-4 py-3.5 text-left transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
                    isSelected
                      ? 'border-o-500 bg-o-50'
                      : 'border-line bg-surface hover:bg-surface-2',
                  )}
                >
                  <p
                    className={cn('text-sm font-semibold', isSelected ? 'text-o-700' : 'text-ink')}
                  >
                    {item.number}
                  </p>
                  <p className="mt-1 text-sm text-ink-2">{item.hotelName}</p>
                  <p className="mt-0.5 text-sm text-ink-3">{describeSize(item)}</p>

                  <p className="mt-2 flex items-center gap-1.5 text-sm text-red">
                    <span className="material-icons-outlined text-base leading-none" aria-hidden>
                      schedule
                    </span>
                    {describeStart(item.startsInDays)}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}
