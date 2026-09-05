import type { ReactNode } from 'react'

import {
  ANY_VALUE,
  EMPTY_POOL_FILTERS,
  type PoolFilters as Filters,
  type PoolOptions,
} from '../types/pool.types'

import { FilterReset } from '@/shared/components/FilterReset'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { SearchField } from '@/shared/components/SearchField'
import { WORKER_STATUSES } from '@/shared/constants/workerStatus'

export function PoolFilters({
  filters,
  options,
  onChange,
  isSearching = false,
}: {
  filters: Filters
  options: PoolOptions | undefined
  onChange: (filters: Filters) => void
  /** La consulta al back en vuelo: el campo enseña el Spinner de shadcn. */
  isSearching?: boolean
}): ReactNode {
  const update =
    <K extends keyof Filters>(key: K) =>
    (value: string): void => {
      onChange({ ...filters, [key]: value })
    }

  const activeCount = [
    filters.search.trim() !== '',
    filters.catalogPositionId !== ANY_VALUE,
    filters.zoneId !== ANY_VALUE,
    filters.englishLevelId !== ANY_VALUE,
    filters.hiringModalityId !== ANY_VALUE,
    filters.status !== ANY_VALUE,
  ].filter(Boolean).length

  return (
    <div className="flex flex-col gap-3">
      {/* Por nombre, contra el back (`GET /workers?search=`): arriba de las píldoras. */}
      <SearchField
        isSearching={isSearching}
        value={filters.search}
        onChange={update('search')}
        label="Buscar colaborador"
        placeholder="Nombre del colaborador, p. ej. Ana Rivera…"
        className="w-full max-w-md"
      />

      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect
          icon="work"
          label="Posición"
          anyLabel="todas"
          value={filters.catalogPositionId}
          onChange={update('catalogPositionId')}
          options={(options?.positions ?? []).map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />

        <FilterSelect
          icon="place"
          label="Zona"
          anyLabel="todas"
          value={filters.zoneId}
          onChange={update('zoneId')}
          options={(options?.zones ?? []).map((item) => ({
            value: item.id,
            label: item.name.replace(/^Zona\s+/i, ''),
          }))}
        />

        <FilterSelect
          icon="translate"
          label="Inglés"
          anyLabel="cualquiera"
          value={filters.englishLevelId}
          onChange={update('englishLevelId')}
          options={(options?.englishLevels ?? []).map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />

        <FilterSelect
          icon="badge"
          label="Modalidad"
          anyLabel="todas"
          value={filters.hiringModalityId}
          onChange={update('hiringModalityId')}
          options={(options?.modalities ?? []).map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />

        <FilterSelect
          icon="traffic"
          label="Estado"
          anyLabel="todos"
          value={filters.status}
          onChange={update('status')}
          options={WORKER_STATUSES.map((status) => ({ value: status, label: status }))}
        />

        <FilterReset
          activeCount={activeCount}
          onReset={() => {
            onChange(EMPTY_POOL_FILTERS)
          }}
        />
      </div>
    </div>
  )
}
