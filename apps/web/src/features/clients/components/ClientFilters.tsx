import type { ReactNode } from 'react'

import {
  ANY_VALUE,
  CLIENT_SORT_LABEL,
  CLIENT_SORTS,
  type ClientFilters as Filters,
} from '../types/client.types'

import { FilterReset } from '@/shared/components/FilterReset'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { SearchField } from '@/shared/components/SearchField'
import { CONTRACT_STATUSES } from '@/shared/constants/contractStatus'

export function ClientFilters({
  filters,
  zoneNames,
  activationYears,
  onChange,
}: {
  filters: Filters
  zoneNames: string[]
  activationYears: number[]
  onChange: (filters: Filters) => void
}): ReactNode {
  const update =
    <K extends keyof Filters>(key: K) =>
    (value: string): void => {
      onChange({ ...filters, [key]: value as Filters[K] })
    }

  /* «Ordenar» no es un filtro: ni cuenta ni se toca al quitarlos. */
  const activeFilters =
    (filters.search.trim() !== '' ? 1 : 0) +
    [filters.zoneName, filters.contractStatus, filters.activationYear].filter(
      (value) => value !== ANY_VALUE,
    ).length

  return (
    <div className="flex flex-wrap items-center gap-4">
      <SearchField
        value={filters.search}
        onChange={update('search')}
        label="Buscar hotel"
        placeholder="Nombre del hotel, p. ej. Puerto Real…"
        className="w-full max-w-md"
      />

      <FilterSelect
        label="Zona"
        anyLabel="todas"
        value={filters.zoneName}
        options={zoneNames.map((zone) => ({ value: zone, label: zone }))}
        onChange={update('zoneName')}
      />

      <FilterSelect
        label="Contrato"
        anyLabel="todos"
        value={filters.contractStatus}
        options={CONTRACT_STATUSES.map((status) => ({ value: status, label: status }))}
        onChange={update('contractStatus')}
      />

      <FilterSelect
        label="Cliente desde"
        anyLabel="siempre"
        value={filters.activationYear}
        options={activationYears.map((year) => ({ value: String(year), label: String(year) }))}
        onChange={update('activationYear')}
      />

      <FilterReset
        activeCount={activeFilters}
        onReset={() => {
          onChange({
            ...filters,
            search: '',
            zoneName: ANY_VALUE,
            contractStatus: ANY_VALUE,
            activationYear: ANY_VALUE,
          })
        }}
      />

      <span className="ml-auto">
        <FilterSelect
          label="Ordenar"
          anyLabel={CLIENT_SORT_LABEL.RECENT}
          anyValue="RECENT"
          value={filters.sort}
          options={CLIENT_SORTS.filter((sort) => sort !== 'RECENT').map((sort) => ({
            value: sort,
            label: CLIENT_SORT_LABEL[sort],
          }))}
          onChange={update('sort')}
        />
      </span>
    </div>
  )
}
