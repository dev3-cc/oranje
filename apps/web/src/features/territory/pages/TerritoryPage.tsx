import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'

import { useGetTerritoryOwnersQuery, useGetTerritoryQuery } from '../api/territoryApi'
import { TerritoryHotelCard } from '../components/TerritoryHotelCard'
import { TerritoryMap } from '../components/TerritoryMap'
import { TerritoryOwnerPicker } from '../components/TerritoryOwnerPicker'
import { TerritoryZoneChips } from '../components/TerritoryZoneChips'

import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { useDebounce } from '@/shared/hooks/useDebounce'

export function TerritoryPage(): ReactNode {
  /** `?q=`: el globo del pipeline manda aquí con el hotel ya buscado. */
  const [searchParams] = useSearchParams()
  const [zoneId, setZoneId] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '')
  const [pickedHotelId, setPickedHotelId] = useState<string | null>(null)
  /** `null` = el mío. El BDC lo cambia con el selector. */
  const [ownerId, setOwnerId] = useState<string | null>(null)

  const search = useDebounce(searchInput)
  /** Sin equipo la consulta falla con 403 y la lista queda vacía: el BD no ve selector. */
  const { data: owners = [] } = useGetTerritoryOwnersQuery()
  const {
    data: territory,
    isLoading,
    isError,
  } = useGetTerritoryQuery({ zoneId, search, userId: ownerId })

  const ownerName = owners.find((owner) => owner.id === ownerId)?.fullName ?? null

  const hotels = territory?.hotels ?? []

  /**
   * Cae al primero de la lista cuando no hay elegido, o cuando el elegido se
   * fue al filtrar: el mapa sin ficha se ve incompleto, y el diseño arranca con
   * el primer hotel seleccionado.
   */
  const selectedHotel = hotels.find((hotel) => hotel.id === pickedHotelId) ?? hotels[0] ?? null

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <section className="flex min-h-0 flex-col rounded-lg border border-line bg-surface p-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {ownerName ? `Territorio de ${ownerName}` : 'Mi Territorio'}
        </h1>

        <TerritoryOwnerPicker
          owners={owners}
          selectedId={ownerId}
          onSelect={(id) => {
            setOwnerId(id)
            /** El hotel elegido es de otro territorio: la ficha caería vacía. */
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

        <div className="mt-4">
          <TerritoryZoneChips
            zones={territory?.zones ?? []}
            total={territory?.total ?? 0}
            selectedZoneId={zoneId}
            onSelect={setZoneId}
          />
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {isLoading && <CardGridSkeleton cards={3} className="grid-cols-1" />}

          {isError && (
            <p className="text-sm text-red">No se pudo cargar tu territorio. Reintenta.</p>
          )}

          {!isLoading && !isError && hotels.length === 0 && (
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

      <TerritoryMap hotels={hotels} selectedHotel={selectedHotel} onSelect={setPickedHotelId} />
    </div>
  )
}
