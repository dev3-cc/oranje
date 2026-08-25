import type { ReactNode } from 'react'

import type { PoolFilters as Filters, PoolOptions } from '../types/pool.types'

import { FilterSelect } from '@/shared/components/FilterSelect'
import { WORKER_STATUSES } from '@/shared/constants/workerStatus'

export function PoolFilters({
  filters,
  options,
  onChange,
}: {
  filters: Filters
  options: PoolOptions | undefined
  onChange: (filters: Filters) => void
}): ReactNode {
  const update =
    <K extends keyof Filters>(key: K) =>
    (value: string): void => {
      onChange({ ...filters, [key]: value })
    }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <FilterSelect
        icon="work"
        label="Posición"
        anyLabel="todas"
        value={filters.catalogPositionId}
        onChange={update('catalogPositionId')}
        options={(options?.positions ?? []).map((item) => ({ value: item.id, label: item.name }))}
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
        options={(options?.modalities ?? []).map((item) => ({ value: item.id, label: item.name }))}
      />

      {}
      <FilterSelect
        icon="traffic"
        label="Estado"
        anyLabel="todos"
        value={filters.status}
        onChange={update('status')}
        options={WORKER_STATUSES.map((status) => ({ value: status, label: status }))}
      />
    </div>
  )
}
