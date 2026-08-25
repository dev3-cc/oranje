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
  } = useGetTerritoryQuery({ zoneId, search, userId: ownerId })

  const ownerName = owners.find((owner) => owner.id === ownerId)?.fullName ?? null

  const hotels = territory?.hotels ?? []

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
            <LoadError
              message="No se pudo cargar tu territorio. Reintenta."
              onRetry={() => {
                void refetch()
              }}
            />
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
