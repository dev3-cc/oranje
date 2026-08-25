import type { ReactNode } from 'react'

import type { ClientCard } from '../types/client.types'

import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TOKEN } from '@/shared/constants/contractStatus'

/**
 * La ficha que se asoma sobre el mapa cuando hay un hotel elegido.
 *
 * Repite lo mínimo para saber que es el correcto —nombre, estado del contrato y
 * folio— y nada más: lo demás ya está en su tarjeta de la izquierda, y llenar
 * el mapa de datos taparía justo lo que se quería ver.
 */
export function ClientMapCard({ client }: { client: ClientCard }): ReactNode {
  return (
    /*
      En la esquina y NO en el centro: `fitBounds` deja los hoteles justo en
      medio del mapa, así que una ficha centrada tapa los pines que se querían
      ver. `pointer-events-none` para que no atrape el arrastre del mapa.
    */
    <div className="pointer-events-none absolute top-6 left-6 z-10 w-64 max-w-[calc(100%-3rem)] rounded-xl border border-line bg-surface p-3 shadow-lg">
      <div className="flex h-20 items-center justify-center rounded-lg bg-surface-3">
        <span className="material-icons-outlined text-2xl text-o-500" aria-hidden>
          apartment
        </span>
      </div>

      <p className="mt-3 text-base font-bold text-ink">{client.hotelName}</p>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {client.contract ? (
          <>
            <StatusLightSoftBadge
              token={CONTRACT_STATUS_TOKEN[client.contract.status]}
              label={CONTRACT_STATUS_LABEL[client.contract.status]}
            />
            <span className="text-sm text-ink-3">{client.contract.number}</span>
          </>
        ) : (
          <span className="text-sm text-ink-3">sin contrato</span>
        )}
      </div>
    </div>
  )
}
