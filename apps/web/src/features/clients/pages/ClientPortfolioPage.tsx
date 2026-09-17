import { Trans, useLingui } from '@lingui/react/macro'
import { statusLight } from '@oranje/ui'
import { useMemo, useState, type ReactNode } from 'react'

import { useGetClientsQuery } from '../api/clientsApi'
import { ClientCardItem } from '../components/ClientCardItem'
import { ClientFilters } from '../components/ClientFilters'
import { ClientSpotlightCard } from '../components/ClientSpotlightCard'
import type { ClientFilters as Filters } from '../types/client.types'

import fotoEquipo from '@/assets/ilustrations/clientes-equipo.webp'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { FoldText } from '@/shared/components/FoldText'
import { HotelPointsMap, type HotelMapPoint } from '@/shared/components/HotelPointsMap'
import { LoadError } from '@/shared/components/LoadError'
import { CONTRACT_STATUS_TOKEN } from '@/shared/constants/contractStatus'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { IS_DEV_UI } from '@/shared/lib/devMode'

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
  const { t } = useLingui()
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  /* El texto espera a que la persona deje de teclear; los selects van al instante. */
  const settledSearch = useDebounce(filters.search)
  const appliedFilters = useMemo(
    () => ({ ...filters, search: settledSearch }),
    [filters, settledSearch],
  )

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

  /** Las tres cifras de la píldora del mapa. */
  const activeContracts = items.filter((client) => client.contract?.status === 'ACTIVE').length
  const averageTenure = useMemo(() => {
    if (items.length === 0) return '—'
    const months =
      items.reduce(
        (sum, client) =>
          sum +
          Math.max(0, (Date.now() - new Date(client.activatedAt).getTime()) / (30.44 * 86_400_000)),
        0,
      ) / items.length
    return months >= 12
      ? t`${String(Math.round(months / 12))} a`
      : t`${String(Math.round(months))} m`
  }, [items, t])

  return (
    <div className="flex flex-col gap-6">
      {/* Misma cabecera-tarjeta que Conversión, Contratos y Propuestas: título
          a la izquierda, la foto (recortada, sin fondo) sentada en el borde
          inferior y sobresaliendo por arriba; el `clip-path` de la tarjeta la
          recorta con las esquinas redondeadas y deja 3rem arriba. */}
      <header className="relative flex items-end justify-between gap-4 rounded-2xl border border-line bg-gradient-to-r from-o-50 via-surface to-surface px-6 pt-5 pb-5 [clip-path:inset(-3rem_0_0_0_round_1rem)] sm:mt-8 sm:min-h-44 sm:pr-80">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text={t`Clientes activos`} />
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-ink-3">
            {IS_DEV_UI ? (
              'commercial.vw_client · hoteles con activated_at'
            ) : (
              <Trans>Hoteles activados como clientes, listos para generar requisiciones</Trans>
            )}
            {portfolio && ` · ${t`${String(portfolio.total)} en cartera`}`}
          </p>
        </div>
        <img
          src={fotoEquipo}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-2 -bottom-1 hidden h-[calc(100%+2.5rem)] w-auto object-contain object-bottom drop-shadow-[0_10px_18px_rgba(60,30,0,0.26)] sm:block"
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
          message={t`No se pudo cargar Clientes Activos. Reintenta en unos segundos.`}
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading && !portfolio ? (
        <CardGridSkeleton cards={4} />
      ) : (
        /* La referencia: la ficha grande a la izquierda, el mapa dominante a la derecha. */
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
              <Trans>
                Ningún hotel coincide con estos filtros. Cambia la búsqueda o quita un filtro.
              </Trans>
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {selected && <ClientSpotlightCard client={selected} />}
              <ul className="flex flex-col gap-3">
                {items
                  .filter((client) => client.id !== selected?.id)
                  .map((client) => (
                    <ClientCardItem
                      key={client.id}
                      client={client}
                      isSelected={false}
                      onSelect={setSelectedId}
                    />
                  ))}
              </ul>
            </div>
          )}

          <div className="relative">
            <HotelPointsMap
              points={points}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
              className="min-h-[42rem] lg:sticky lg:top-6"
            />
            {/* La píldora oscura de métricas, flotando sobre el mapa (referencia). */}
            {portfolio && (
              <div className="pointer-events-none absolute top-4 left-1/2 z-10 flex -translate-x-1/2 items-stretch divide-x divide-white/20 rounded-2xl bg-ink/90 px-2 py-2.5 text-white shadow-lg backdrop-blur-sm">
                <div className="px-4 text-center">
                  <p className="text-lg leading-tight font-bold">{portfolio.total}</p>
                  <p className="text-[11px] text-white/70">
                    <Trans>clientes</Trans>
                  </p>
                </div>
                <div className="px-4 text-center">
                  <p className="text-lg leading-tight font-bold">{activeContracts}</p>
                  <p className="text-[11px] text-white/70">
                    <Trans>con contrato vigente</Trans>
                  </p>
                </div>
                <div className="px-4 text-center">
                  <p className="text-lg leading-tight font-bold">{averageTenure}</p>
                  <p className="text-[11px] text-white/70">
                    <Trans>promedio como cliente</Trans>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
