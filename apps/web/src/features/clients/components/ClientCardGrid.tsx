import { Plural, useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { ClientCard } from '../types/client.types'

import { HotelPhotoBackdrop } from '@/shared/components/HotelPhotoBackdrop'
import { MagicCard } from '@/shared/components/MagicCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TOKEN } from '@/shared/constants/contractStatus'
import { formatDate, formatMoney } from '@/shared/lib/formatters'

/**
 * Los clientes como tarjetas de hotel, el mismo patrón de Contratos: la foto
 * distingue una tarjeta de otra (dos hoteles no se parecen; dos filas de datos
 * sí), y cada una es un enlace directo a su ficha — sin un paso de "elegir"
 * de por medio. Elegir un pin del mapa es otra cosa: muestra la tarjeta
 * grande flotando sobre el mapa mismo, no aquí.
 */
export function ClientCardGrid({ clients }: { clients: ClientCard[] }): ReactNode {
  const { t } = useLingui()

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {clients.map((client) => {
        const { contract } = client
        return (
          <li key={client.id}>
            <MagicCard className="rounded-2xl">
              <Link
                to={`/pipeline/${client.prospectId}`}
                className="block touch-manipulation overflow-hidden rounded-2xl bg-surface shadow-md transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
              >
                <div className="relative h-28">
                  <HotelPhotoBackdrop photoUrl={client.photoUrl} />
                  <div
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent via-surface/70 to-surface"
                  />
                  <span className="absolute top-2 right-2 rounded-full bg-surface/90 p-0.5 shadow-sm backdrop-blur-sm">
                    {contract ? (
                      <StatusLightSoftBadge
                        token={CONTRACT_STATUS_TOKEN[contract.status]}
                        label={CONTRACT_STATUS_LABEL[contract.status]}
                      />
                    ) : (
                      <span className="rounded-full px-3 py-1 text-xs font-medium text-ink-3">
                        {t`sin contrato`}
                      </span>
                    )}
                  </span>
                </div>

                <div className="p-4 pt-1">
                  <p className="truncate text-base font-semibold text-ink" title={client.hotelName}>
                    {client.hotelName}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-ink-3">
                    {t`Zona ${client.zoneName} · cliente desde ${formatDate(client.activatedAt)}`}
                  </p>

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                    <span className="text-sm text-ink-2">
                      {contract ? (
                        <Plural
                          value={contract.positionCount}
                          one="# posición"
                          other="# posiciones"
                        />
                      ) : (
                        t`geocerca ${client.geofenceRadiusM} m`
                      )}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-ink">
                      {contract
                        ? contract.maxRate === contract.minRate
                          ? formatMoney(contract.minRate)
                          : `${formatMoney(contract.minRate)} – ${formatMoney(contract.maxRate)}`
                        : t`Sin tarifas`}
                    </span>
                  </div>
                </div>
              </Link>
            </MagicCard>
          </li>
        )
      })}
    </ul>
  )
}
