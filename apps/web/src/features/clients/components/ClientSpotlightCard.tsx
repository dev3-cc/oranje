import { MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { ClientCard } from '../types/client.types'

import { HotelPhoto } from './HotelPhoto'

import { buttonClass } from '@/shared/components/Button'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TOKEN } from '@/shared/constants/contractStatus'
import { formatDate, formatMoney } from '@/shared/lib/formatters'

/** Meses completos desde una fecha ISO; en años cuando ya pasó de 12. */
function tenureLabel(iso: string): string {
  const months = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / (30.44 * 86_400_000)),
  )
  if (months >= 12) return `${String(Math.floor(months / 12))} a`
  if (months === 0) return 'Nuevo'
  return `${String(months)} m`
}

/** Un dato del trío: número grande y su etiqueta, como la referencia. */
function StatTile({
  icon,
  value,
  label,
}: {
  icon: string
  value: string
  label: string
}): ReactNode {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3 text-center">
      <MaterialIcon name={icon} className="text-lg text-ink-3" aria-hidden />
      <p className="mt-1 text-xl font-bold text-ink">{value}</p>
      <p className="text-xs text-ink-3">{label}</p>
    </div>
  )
}

/**
 * El cliente elegido, en grande (diseño de referencia tipo inmobiliaria):
 * su foto de portada, quién es, el trío de datos, el contrato y el CTA a su
 * ficha — que es la MISMA del Pipeline, porque un cliente es un prospecto
 * que llegó a Naranja.
 */
export function ClientSpotlightCard({ client }: { client: ClientCard }): ReactNode {
  const { contract } = client

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface shadow-md">
      <div className="relative h-44">
        <HotelPhoto photoUrl={client.photoUrl} className="size-full" />
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-ink">{client.hotelName}</h2>
            <p className="mt-0.5 text-sm text-ink-3">
              Zona {client.zoneName} · {client.timezone}
            </p>
          </div>
          {contract ? (
            <StatusLightSoftBadge
              token={CONTRACT_STATUS_TOKEN[contract.status]}
              label={CONTRACT_STATUS_LABEL[contract.status]}
            />
          ) : (
            <span className="shrink-0 rounded-full bg-surface-3 px-3 py-1 text-xs font-medium text-ink-3">
              sin contrato
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatTile
            icon="calendar_month"
            value={tenureLabel(client.activatedAt)}
            label="como cliente"
          />
          <StatTile
            icon="badge"
            value={contract ? String(contract.positionCount) : '—'}
            label={contract?.positionCount === 1 ? 'posición' : 'posiciones'}
          />
          <StatTile
            icon="share_location"
            value={`${String(client.geofenceRadiusM)} m`}
            label="geocerca"
          />
        </div>

        {contract && (
          <Link
            to={`/documentos-tc/${contract.id}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 transition-colors hover:border-o-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">{contract.number}</span>
              <span className="block text-xs text-ink-3">
                Se factura {formatMoney(contract.minRate)}
                {contract.maxRate !== contract.minRate && ` – ${formatMoney(contract.maxRate)}`} por
                hora
              </span>
            </span>
            <MaterialIcon name="chevron_right" className="shrink-0 text-ink-3" aria-hidden />
          </Link>
        )}

        <p className="text-xs text-ink-3">Cliente desde {formatDate(client.activatedAt)}</p>

        <Link
          to={`/pipeline/${client.prospectId}`}
          className={buttonClass('primary', 'w-full text-center')}
        >
          Abrir ficha del hotel
        </Link>
      </div>
    </article>
  )
}
