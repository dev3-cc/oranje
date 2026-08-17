import { useState, type ReactNode } from 'react'

import { useGetTerritoryQuery } from '../api/territoryApi'
import { TerritoryHotelCard } from '../components/TerritoryHotelCard'
import { TerritoryMap } from '../components/TerritoryMap'
import { TerritoryZoneChips } from '../components/TerritoryZoneChips'

import { useDebounce } from '@/shared/hooks/useDebounce'

export function TerritoryPage(): ReactNode {
  const [zoneId, setZoneId] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [pickedHotelId, setPickedHotelId] = useState<string | null>(null)

  const search = useDebounce(searchInput)
  const { data: territory, isLoading, isError } = useGetTerritoryQuery({ zoneId, search })

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
        <h1 className="text-2xl font-bold tracking-tight text-ink">Mi Territorio</h1>

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
          {isLoading && <p className="text-sm text-ink-3">Cargando territorio…</p>}

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
