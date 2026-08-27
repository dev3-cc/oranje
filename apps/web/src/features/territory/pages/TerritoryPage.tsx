import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'

import { useGetTerritoryOwnersQuery, useGetTerritoryQuery } from '../api/territoryApi'
import { TerritoryHotelCard } from '../components/TerritoryHotelCard'
import { TerritoryMap } from '../components/TerritoryMap'
import { TerritoryOwnerPicker } from '../components/TerritoryOwnerPicker'
import { TerritoryZoneChips } from '../components/TerritoryZoneChips'

import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { LoadError } from '@/shared/components/LoadError'
import { useDebounce } from '@/shared/hooks/useDebounce'

/** jsdom no trae matchMedia: en pruebas se asume pantalla ancha. */
function isWideScreen(): boolean {
  return typeof window.matchMedia !== 'function' || window.matchMedia('(min-width: 640px)').matches
}

export function TerritoryPage(): ReactNode {
  const [searchParams] = useSearchParams()
  const [zoneId, setZoneId] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '')
  const [pickedHotelId, setPickedHotelId] = useState<string | null>(null)
  const [ownerId, setOwnerId] = useState<string | null>(null)

  const search = useDebounce(searchInput)
  const { data: owners = [] } = useGetTerritoryOwnersQuery()
  const {
    data: territory,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useGetTerritoryQuery({ zoneId, search, userId: ownerId })

  const ownerName = owners.find((owner) => owner.id === ownerId)?.fullName ?? null

  const hotels = territory?.hotels ?? []

  /**
   * `'NONE'` = la persona CERRÓ la ficha: no se le vuelve a imponer. Sin
   * elección todavía, en pantalla ancha se abre el primero (contexto útil);
   * en móvil la hoja taparía el mapa, así que nace cerrada.
   */
  const selectedHotel =
    pickedHotelId === 'NONE'
      ? null
      : (hotels.find((hotel) => hotel.id === pickedHotelId) ??
        (isWideScreen() ? (hotels[0] ?? null) : null))

  return (
    <div className="grid grid-cols-1 gap-5 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <section className="flex flex-col rounded-lg border border-line bg-surface p-6 xl:min-h-0">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {ownerName ? `Territorio de ${ownerName}` : 'Mi Territorio'}
        </h1>

        <TerritoryOwnerPicker
          owners={owners}
          selectedId={ownerId}
          onSelect={(id) => {
            setOwnerId(id)
            setPickedHotelId(null)
          }}
        />

        <input
          type="search"
          value={searchInput}
          onChange={(event) => {
            setSearchInput(event.target.value)
          }}
          aria-label="Buscar hotel en mi territorio"
          placeholder="Buscar hotel en mi territorio..."
          className="mt-4 w-full rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none"
        />
        {/* La lista de abajo ES el resultado: aquí solo se avisa que se busca. */}
        {isFetching && searchInput !== '' && (
          <p className="mt-1.5 flex items-center gap-2 text-xs text-ink-3" role="status">
            <span
              aria-hidden
              className="size-3 animate-spin rounded-full border-2 border-o-500 border-t-transparent"
            />
            Buscando «{searchInput}»…
          </p>
        )}

        <div className="mt-4">
          <TerritoryZoneChips
            zones={territory?.zones ?? []}
            total={territory?.total ?? 0}
            selectedZoneId={zoneId}
            onSelect={setZoneId}
          />
        </div>

        <div className="mt-4 flex max-h-80 flex-col gap-3 overflow-y-auto xl:max-h-none xl:min-h-0 xl:flex-1">
          {isLoading && <CardGridSkeleton cards={3} className="grid-cols-1" />}

          {isError && (
            <LoadError
              message="No se pudo cargar tu territorio. Reintenta."
              onRetry={() => {
                void refetch()
              }}
            />
          )}

          {!isLoading && !isError && !isFetching && hotels.length === 0 && (
            <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-ink-3">
              Ningún hotel de tu territorio coincide con el filtro.
            </p>
          )}

          {hotels.map((hotel) => (
            <TerritoryHotelCard
              key={hotel.id}
              hotel={hotel}
              isSelected={hotel.id === selectedHotel?.id}
              onSelect={setPickedHotelId}
            />
          ))}
        </div>
      </section>

      <TerritoryMap
        hotels={hotels}
        selectedHotel={selectedHotel}
        onSelect={setPickedHotelId}
        onClose={() => {
          setPickedHotelId('NONE')
        }}
      />
    </div>
  )
}
