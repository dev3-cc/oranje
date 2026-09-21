import { plural } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { AuthorizationRequest } from '../types/requisition.types'

import { HotelThumbnail } from '@/shared/components/HotelThumbnail'
import { MagicCard } from '@/shared/components/MagicCard'
import { SectionCard } from '@/shared/components/SectionCard'

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
  emptyMessage,
}: {
  items: AuthorizationRequest[]
  selectedId: string
  onSelect: (requisitionId: string) => void
  /** Qué decir sin renglones: la cola vacía y un filtro que no deja nada no son lo mismo. */
  emptyMessage?: string
}): ReactNode {
  const { t } = useLingui()

  /** `2 pos · 2 slots`, con el singular donde toca. */
  function describeSize(request: AuthorizationRequest): string {
    const { department, positionCount, slotCount } = request
    return t`${department} · ${positionCount} pos · ${plural(slotCount, { one: '# slot', other: '# slots' })}`
  }

  /* Una requisición sin firma cuya fecha ya pasó decía «Inicia en -4 días». */
  function describeStart(days: number): string {
    if (days < 0) {
      const late = -days
      return t`${plural(late, { one: 'Debió iniciar hace # día', other: 'Debió iniciar hace # días' })}`
    }
    return t`${plural(days, { 0: 'Inicia hoy', one: 'Inicia en # día', other: 'Inicia en # días' })}`
  }

  return (
    <SectionCard title={t`Pendientes`} subtitle={t`Ordenadas por fecha de inicio más próxima`}>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-3">
          {emptyMessage ?? t`No hay requisiciones esperando tu firma.`}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const isSelected = item.id === selectedId

            return (
              <li key={item.id}>
                {/* Magic Bento (reactbits): la fila avisa al pasar; se apaga sola en táctil y reduced motion. */}
                <MagicCard className="rounded-lg">
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
                    <div className="flex items-start gap-3">
                      <HotelThumbnail photoUrl={item.hotelPhotoUrl} />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'text-sm font-semibold',
                            isSelected ? 'text-o-700' : 'text-ink',
                          )}
                        >
                          {item.number}
                        </p>
                        <p className="mt-1 text-sm text-ink-2">{item.hotelName}</p>
                        <p className="mt-0.5 text-sm text-ink-3">{describeSize(item)}</p>

                        <p className="mt-2 flex items-center gap-1.5 text-sm text-red">
                          <span
                            className="material-icons-outlined text-base leading-none"
                            aria-hidden
                          >
                            schedule
                          </span>
                          {describeStart(item.startsInDays)}
                        </p>
                      </div>
                    </div>
                  </button>
                </MagicCard>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}
