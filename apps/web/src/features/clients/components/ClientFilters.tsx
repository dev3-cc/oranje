import type { ChangeEvent, ReactNode } from 'react'

import {
  CLIENT_SORT_LABEL,
  CLIENT_SORTS,
  type ClientFilters as Filters,
} from '../types/client.types'

import { FilterSelect } from '@/shared/components/FilterSelect'
import { CONTRACT_STATUSES } from '@/shared/constants/contractStatus'

const SEARCH_CLASS =
  'rounded-full border border-line bg-surface px-5 py-2.5 text-sm text-ink transition-colors placeholder:text-ink-4 hover:bg-surface-2 focus:border-o-500 focus:outline-none'

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

  return (
    <div className="flex flex-wrap items-center gap-4">
      <input
        type="search"
        value={filters.search}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          update('search')(event.target.value)
        }}
        placeholder="Buscar hotel…"
        aria-label="Buscar hotel"
        className={`${SEARCH_CLASS} min-w-64`}
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

      {}
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
