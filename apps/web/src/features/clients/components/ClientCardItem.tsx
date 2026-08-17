import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { ClientCard } from '../types/client.types'

import { Button } from '@/shared/components/Button'
import { SemaforoSoftBadge } from '@/shared/components/SemaforoSoftBadge'
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TOKEN } from '@/shared/constants/contractStatus'
import { formatDate, formatMoney } from '@/shared/lib/formatters'

/** Un dato de la tarjeta: fondo tenue y borde, sin color de estado. */
function Fact({ children }: { children: ReactNode }): ReactNode {
  return (
    <span className="inline-flex items-center rounded-md border border-line bg-surface-2 px-3 py-1.5 text-sm whitespace-nowrap text-ink-2">
      {children}
    </span>
  )
}

/**
 * Un hotel de la cartera.
 *
 * Los cuatro datos de en medio NO llevan color: el único chip con semáforo es
 * el del contrato, arriba a la derecha. Si el folio y las tarifas compitieran en
 * color con él, el verde diría dos cosas distintas en la misma tarjeta.
 */
export function ClientCardItem({
  client,
  isSelected,
  onSelect,
}: {
  client: ClientCard
  isSelected: boolean
  onSelect: (clientId: string) => void
}): ReactNode {
  const { contract } = client

  return (
    <li>
      <article
        className={cn(
          'rounded-xl border bg-surface p-4 transition-colors',
          isSelected ? 'border-o-500' : 'border-line hover:bg-surface-2',
        )}
      >
        <div className="flex gap-4">
          {/*
            Marcador de la foto del edificio. Es un botón porque seleccionar el
            hotel mueve el mapa: la miniatura y el nombre hacen lo mismo.
          */}
          <button
            type="button"
            aria-label={`Ver ${client.hotelName} en el mapa`}
            onClick={() => {
              onSelect(client.id)
            }}
            className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
          >
            <span className="material-icons-outlined text-2xl text-o-500" aria-hidden>
              apartment
            </span>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-ink">
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(client.id)
                    }}
                    className="rounded-sm text-left hover:text-o-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
                  >
                    {client.hotelName}
                  </button>
                </h3>
                <p className="mt-0.5 text-sm text-ink-3">
                  Zona {client.zoneName} · cliente desde {formatDate(client.activatedAt)}
                </p>
              </div>

              {contract ? (
                <SemaforoSoftBadge
                  token={CONTRACT_STATUS_TOKEN[contract.status]}
                  label={CONTRACT_STATUS_LABEL[contract.status]}
                />
              ) : (
                <span className="rounded-full bg-surface-3 px-3 py-1.5 text-sm font-medium text-ink-3">
                  sin contrato
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {contract && (
                <>
                  {/* El folio abre su contrato, como en Documentos T&C. */}
                  <Link
                    to={`/documentos-tc/${contract.id}`}
                    className="inline-flex items-center rounded-md border border-line bg-surface-2 px-3 py-1.5 text-sm whitespace-nowrap text-ink-2 hover:border-o-500 hover:text-o-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
                  >
                    {contract.number}
                  </Link>
                  <Fact>
                    {contract.positionCount}{' '}
                    {contract.positionCount === 1 ? 'posición' : 'posiciones'}
                  </Fact>
                  <Fact>
                    {formatMoney(contract.minRate)} – {formatMoney(contract.maxRate)}
                  </Fact>
                </>
              )}
              <Fact>geocerca {client.geofenceRadiusM} m</Fact>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {/* La zona horaria del hotel decide a qué día pertenece una checada. */}
          <p className="text-sm text-ink-3">{client.timezone}</p>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              disabled
              title="Pendiente: el formulario de hotel vive hoy dentro de Onboarding"
              className="border-transparent bg-transparent px-2"
            >
              Editar hotel
            </Button>

            {/*
              Lleva a la ficha del Pipeline, que es la misma del hotel: un
              cliente es un prospecto que llegó a NARANJA, no otra entidad. Allá
              el semáforo sale naranja y el historial trae el ciclo completo.
              El contrato tiene su propio enlace en el chip del folio.
            */}
            <Link
              to={`/pipeline/${client.prospectId}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-o-50 px-4 py-2 text-sm font-medium text-o-700 hover:bg-o-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
            >
              Ver detalle <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </article>
    </li>
  )
}
