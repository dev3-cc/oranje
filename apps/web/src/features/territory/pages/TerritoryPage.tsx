import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'

import { useGetTerritoryOwnersQuery, useGetTerritoryQuery } from '../api/territoryApi'
import { TerritoryHotelCard } from '../components/TerritoryHotelCard'
import { TerritoryMap } from '../components/TerritoryMap'
import { TerritoryOwnerPicker } from '../components/TerritoryOwnerPicker'
import { TerritoryZoneChips } from '../components/TerritoryZoneChips'

import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { FilterReset } from '@/shared/components/FilterReset'
import { LoadError } from '@/shared/components/LoadError'
import { SearchField } from '@/shared/components/SearchField'
import { useDebounce } from '@/shared/hooks/useDebounce'

/** jsdom no trae matchMedia: en pruebas se asume pantalla ancha. */
function isWideScreen(): boolean {
  return typeof window.matchMedia !== 'function' || window.matchMedia('(min-width: 640px)').matches
}

export function TerritoryPage(): ReactNode {
  const [searchParams, setSearchParams] = useSearchParams()
  const [zoneId, setZoneId] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '')
  const [pickedHotelId, setPickedHotelId] = useState<string | null>(null)
  const [ownerId, setOwnerId] = useState<string | null>(null)

  const search = useDebounce(searchInput)

  /*
   * La URL refleja la búsqueda (`?q=`): un enlace o un refresh vuelven al
   * mismo resultado. Se escribe la asentada y con `replace` — una entrada de
   * historial por tecla haría inservible el botón Atrás. `writtenQ` recuerda
   * lo último que pasó por aquí para distinguir un cambio nuestro de uno
   * ajeno (el enlace del menú sin `?q=` mientras la página sigue montada).
   */
  const writtenQ = useRef(searchParams.get('q') ?? '')
  useEffect(() => {
    if (search === writtenQ.current) return
    writtenQ.current = search
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (search === '') next.delete('q')
        else next.set('q', search)
        return next
      },
      { replace: true },
    )
  }, [search, setSearchParams])
  useEffect(() => {
    const q = searchParams.get('q') ?? ''
    if (q === writtenQ.current) return
    writtenQ.current = q
    setSearchInput(q)
  }, [searchParams])

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
    <div className="grid grid-cols-1 gap-5 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <section className="flex flex-col rounded-lg border border-line bg-surface p-6 lg:min-h-0">
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

        <SearchField
          value={searchInput}
          onChange={setSearchInput}
          isSearching={isFetching && searchInput !== ''}
          label="Buscar hotel en mi territorio"
          placeholder="Nombre del hotel, p. ej. Puerto Real…"
          className="mt-4 w-full"
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <TerritoryZoneChips
            zones={territory?.zones ?? []}
            total={territory?.total ?? 0}
            selectedZoneId={zoneId}
            onSelect={setZoneId}
          />
          {/* De quién es el territorio no es un filtro: es el alcance de la pantalla. */}
          <FilterReset
            activeCount={(searchInput.trim() !== '' ? 1 : 0) + (zoneId !== null ? 1 : 0)}
            onReset={() => {
              setSearchInput('')
              setZoneId(null)
            }}
          />
        </div>

        <div className="mt-4 flex max-h-80 flex-col gap-3 overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1">
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
              Ningún hotel de tu territorio coincide con estos filtros. Cambia la búsqueda o elige
              otra zona.
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
