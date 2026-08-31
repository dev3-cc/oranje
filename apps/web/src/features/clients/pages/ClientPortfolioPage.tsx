import { statusLight } from '@oranje/ui'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { useGetClientsQuery } from '../api/clientsApi'
import { ClientCardItem } from '../components/ClientCardItem'
import { ClientFilters } from '../components/ClientFilters'
import { ClientMapCard } from '../components/ClientMapCard'
import type { ClientFilters as Filters } from '../types/client.types'

import tratoCerrado from '@/assets/ilustrations/personaje-trato-cerrado.svg'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { FoldText } from '@/shared/components/FoldText'
import { HotelPointsMap, type HotelMapPoint } from '@/shared/components/HotelPointsMap'
import { LoadError } from '@/shared/components/LoadError'
import { CONTRACT_STATUS_TOKEN } from '@/shared/constants/contractStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'

/** Cuánto se espera a que alguien deje de teclear antes de preguntar al servidor. */
const SEARCH_DEBOUNCE_MS = 300

const EMPTY_FILTERS: Filters = {
  search: '',
  zoneName: 'ALL',
  contractStatus: 'ALL',
  activationYear: 'ALL',
  sort: 'RECENT',
}

/** Un hotel sin contrato no tiene semáforo: se pinta gris, no verde ni rojo. */
const NO_CONTRACT_COLOR = statusLight['st-gris']

/**
 * Clientes Activos: los hoteles con `activated_at`, en lista y en mapa.
 *
 * La lista y el mapa comparten selección en los dos sentidos —elegir una
 * tarjeta mueve el mapa y elegir un pin resalta su tarjeta—: son dos vistas de
 * lo mismo, y que cada una llevara su propio foco obligaría a buscar dos veces.
 */
export function ClientPortfolioPage(): ReactNode {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedFilters(filters)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [filters])

  const { data: portfolio, isLoading, isError, refetch } = useGetClientsQuery(appliedFilters)

  const items = useMemo(() => portfolio?.items ?? [], [portfolio])

  const points = useMemo<HotelMapPoint[]>(
    () =>
      items.map((client) => ({
        id: client.id,
        title: client.hotelName,
        location: client.location,
        color: client.contract
          ? statusLight[CONTRACT_STATUS_TOKEN[client.contract.status]]
          : NO_CONTRACT_COLOR,
        // El mapa dibuja la geocerca solo del hotel elegido.
        radiusM: client.geofenceRadiusM,
      })),
    [items],
  )

  // Si el filtro se llevó al hotel elegido, manda el primero de los que quedan.
  const selected = items.find((client) => client.id === selectedId) ?? items[0] ?? null

  return (
    <div className="flex flex-col gap-6">
      <header className="relative isolate flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text="Clientes activos" />
          </h1>
          <p className="mt-1.5 text-sm text-ink-3">
            {IS_DEV_UI
              ? 'commercial.vw_client · hoteles con activated_at'
              : 'Hoteles activados como clientes, listos para generar requisiciones'}
            {portfolio && ` · ${String(portfolio.total)} en cartera`}
          </p>
        </div>
        {/* Marca de agua: grande, opacada y disuelta con degradado hacia el contenido. */}
        <img
          src={tratoCerrado}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -top-8 right-0 -z-10 hidden h-56 w-auto opacity-30 sm:block"
          style={{
            maskImage: 'linear-gradient(210deg, rgb(0 0 0) 25%, transparent 90%)',
            WebkitMaskImage: 'linear-gradient(210deg, rgb(0 0 0) 25%, transparent 90%)',
          }}
        />
      </header>

      <ClientFilters
        filters={filters}
        zoneNames={portfolio?.zoneNames ?? []}
        activationYears={portfolio?.activationYears ?? []}
        onChange={setFilters}
      />

      {isError && (
        <LoadError
          message="No se pudo cargar Clientes Activos. Reintenta en unos segundos."
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading && !portfolio ? (
        <CardGridSkeleton cards={4} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
              Ningún hotel coincide con estos filtros. Cambia la búsqueda o quita un filtro.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {items.map((client) => (
                <ClientCardItem
                  key={client.id}
                  client={client}
                  isSelected={client.id === selected?.id}
                  onSelect={setSelectedId}
                />
              ))}
            </ul>
          )}

          <HotelPointsMap
            points={points}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            className="min-h-[42rem] xl:sticky xl:top-6"
          >
            {selected && <ClientMapCard client={selected} />}
          </HotelPointsMap>
        </div>
      )}
    </div>
  )
}
