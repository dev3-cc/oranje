import { statusLight } from '@oranje/ui'
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'

import { useGetClientsQuery } from '../api/clientsApi'
import { ClientCardItem } from '../components/ClientCardItem'
import { ClientFilters } from '../components/ClientFilters'
import { ClientSpotlightCard } from '../components/ClientSpotlightCard'
import type { ClientFilters as Filters } from '../types/client.types'

import tratoCerrado from '@/assets/ilustrations/personaje-trato-cerrado.svg'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { FoldText } from '@/shared/components/FoldText'
import { HotelPointsMap, type HotelMapPoint } from '@/shared/components/HotelPointsMap'
import { LoadError } from '@/shared/components/LoadError'
import { CONTRACT_STATUS_TOKEN } from '@/shared/constants/contractStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { supportsWebGl } from '@/shared/lib/webgl'

/* La vitrina trae ogl (WebGL): entra en perezoso, como el globo del dashboard. */
const CircularGallery = lazy(() =>
  import('@/shared/components/CircularGallery').then((module) => ({
    default: module.CircularGallery,
  })),
)

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
    return months >= 12 ? `${String(Math.round(months / 12))} a` : `${String(Math.round(months))} m`
  }, [items])
  /** Solo clientes con foto: la vitrina es de imágenes reales, no de placeholders. */
  const galleryItems = useMemo(
    () =>
      items
        .filter((client) => client.photoUrl !== null)
        .map((client) => ({ image: client.photoUrl ?? '', text: client.hotelName })),
    [items],
  )

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

      {/*
       * La vitrina (Circular Gallery de reactbits): los clientes con foto, en
       * arco y arrastrables. Solo si hay al menos 3 con foto y WebGL responde;
       * la rejilla de abajo sigue siendo la lista completa.
       */}
      {galleryItems.length >= 3 && supportsWebGl() && (
        <div className="h-64 overflow-hidden rounded-2xl bg-ink">
          <Suspense fallback={null}>
            <CircularGallery items={galleryItems} bend={2.5} borderRadius={0.06} />
          </Suspense>
        </div>
      )}

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
        /* La referencia: la ficha grande a la izquierda, el mapa dominante a la derecha. */
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
              Ningún hotel coincide con estos filtros. Cambia la búsqueda o quita un filtro.
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
                  <p className="text-[11px] text-white/70">clientes</p>
                </div>
                <div className="px-4 text-center">
                  <p className="text-lg leading-tight font-bold">{activeContracts}</p>
                  <p className="text-[11px] text-white/70">con contrato vigente</p>
                </div>
                <div className="px-4 text-center">
                  <p className="text-lg leading-tight font-bold">{averageTenure}</p>
                  <p className="text-[11px] text-white/70">promedio como cliente</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
