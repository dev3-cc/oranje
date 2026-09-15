import { Plural, useLingui } from '@lingui/react/macro'
import { MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { ContractRow } from '../types/contract.types'

import { HotelPhotoBackdrop } from '@/shared/components/HotelPhotoBackdrop'
import { MagicCard } from '@/shared/components/MagicCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TOKEN } from '@/shared/constants/contractStatus'
import { formatDate, formatMoney } from '@/shared/lib/formatters'

/**
 * Los contratos como tarjetas de hotel, el patrón del Pipeline y del tablero de
 * Requisiciones.
 *
 * La foto del hotel es lo que distingue una tarjeta de otra: el documento es el
 * mismo machote para todos, así que una miniatura del papel sería idéntica en
 * las cincuenta. Debajo va lo único que se viene a saber de un vistazo — si
 * está vigente, desde cuándo y a partir de cuánto se factura.
 */
export function ContractCardGrid({ rows }: { rows: ContractRow[] }): ReactNode {
  const { t } = useLingui()

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <li key={row.id}>
          <MagicCard className="rounded-2xl">
            <Link
              to={`/contracts/${row.id}`}
              className="block touch-manipulation overflow-hidden rounded-2xl bg-surface shadow-md transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
            >
              <div className="relative h-28">
                <HotelPhotoBackdrop photoUrl={row.hotelPhotoUrl} />
                <div
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent via-surface/70 to-surface"
                />
                {/* Sobre una foto clara el chip se perdía: va en una pastilla
                    opaca, que es lo que lo hace legible con cualquier fondo. */}
                <span className="absolute top-2 right-2 rounded-full bg-surface/90 p-0.5 shadow-sm backdrop-blur-sm">
                  <StatusLightSoftBadge
                    token={CONTRACT_STATUS_TOKEN[row.status]}
                    label={CONTRACT_STATUS_LABEL[row.status]}
                  />
                </span>
              </div>

              <div className="p-4 pt-1">
                <p className="truncate text-base font-semibold text-ink" title={row.hotelName}>
                  {row.hotelName}
                </p>
                <p className="mt-0.5 truncate text-sm text-ink-3">
                  {row.validFrom === null
                    ? t`Sin vigencia todavía`
                    : t`Rige desde ${formatDate(row.validFrom)}`}
                </p>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                  <span className="flex items-center gap-1.5 text-sm text-ink-2">
                    <MaterialIcon name="work" aria-hidden className="text-base text-ink-3" />
                    <Plural value={row.positionCount} one="# puesto" other="# puestos" />
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-ink">
                    {row.minBillRate === null
                      ? t`Sin tarifas`
                      : t`desde ${formatMoney(row.minBillRate)}`}
                  </span>
                </div>
              </div>
            </Link>
          </MagicCard>
        </li>
      ))}
    </ul>
  )
}
