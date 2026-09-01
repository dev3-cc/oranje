import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { ContractRow } from '../types/contract.types'

import { ValidityCell } from './ValidityCell'

import { EmptyState } from '@/shared/components/EmptyState'
import { MagicCard } from '@/shared/components/MagicCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TOKEN } from '@/shared/constants/contractStatus'

/**
 * La lista de la izquierda (patrón lista-detalle de Mi Equipo): un renglón
 * por contrato con lo que se decide de un vistazo — folio, hotel, estado y
 * la vigencia con su barra. Elegirlo abre el documento a la derecha.
 */
export function ContractRowList({
  items,
  warningDays,
  selectedId,
  onSelect,
}: {
  items: ContractRow[]
  warningDays: number
  selectedId: string | null
  onSelect: (contractId: string) => void
}): ReactNode {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Ningún contrato coincide"
        text="Cambia el estado, la zona o la búsqueda. Un hotel gana su contrato al negociar los Documentos T&C."
      />
    )
  }

  return (
    /* En angosto la lista es una TIRA horizontal sobre el documento: eliges y el
       detalle queda a la vista, en vez de mandarlo al fondo de la página. */
    <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
      {items.map((row) => {
        const isSelected = row.id === selectedId
        return (
          <li key={row.id} className="w-72 shrink-0 snap-start lg:w-auto">
            <MagicCard className="rounded-xl">
              <button
                type="button"
                onClick={() => {
                  onSelect(row.id)
                }}
                aria-pressed={isSelected}
                className={cn(
                  'w-full cursor-pointer touch-manipulation rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
                  isSelected ? 'border-o-500 bg-o-50' : 'border-line bg-surface hover:bg-surface-2',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {row.number}
                    </span>
                    <span className="block truncate text-xs text-ink-3">{row.hotelName}</span>
                  </span>
                  <StatusLightSoftBadge
                    token={CONTRACT_STATUS_TOKEN[row.status]}
                    label={CONTRACT_STATUS_LABEL[row.status]}
                  />
                </div>
                <div className="mt-2">
                  <ValidityCell row={row} warningDays={warningDays} />
                </div>
              </button>
            </MagicCard>
          </li>
        )
      })}
    </ul>
  )
}
