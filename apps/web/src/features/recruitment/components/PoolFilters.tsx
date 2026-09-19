import { useLingui } from '@lingui/react/macro'
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
import { WORKER_STATUS_LABEL, WORKER_STATUSES } from '@/shared/constants/workerStatus'

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
  const { t } = useLingui()
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
        label={t`Buscar colaborador`}
        placeholder={t`Nombre del colaborador, p. ej. Ana Rivera…`}
        className="w-full max-w-md"
      />

      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect
          icon="work"
          label={t`Posición`}
          anyLabel={t`todas`}
          value={filters.catalogPositionId}
          onChange={update('catalogPositionId')}
          options={(options?.positions ?? []).map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />

        <FilterSelect
          icon="place"
          label={t`Zona`}
          anyLabel={t`todas`}
          value={filters.zoneId}
          onChange={update('zoneId')}
          options={(options?.zones ?? []).map((item) => ({
            value: item.id,
            label: item.name.replace(/^Zona\s+/i, ''),
          }))}
        />

        <FilterSelect
          icon="translate"
          label={t`Inglés`}
          anyLabel={t`cualquiera`}
          value={filters.englishLevelId}
          onChange={update('englishLevelId')}
          options={(options?.englishLevels ?? []).map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />

        <FilterSelect
          icon="badge"
          label={t`Modalidad`}
          anyLabel={t`todas`}
          value={filters.hiringModalityId}
          onChange={update('hiringModalityId')}
          options={(options?.modalities ?? []).map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />

        <FilterSelect
          icon="traffic"
          label={t`Estado`}
          anyLabel={t`todos`}
          value={filters.status}
          onChange={update('status')}
          /* El código del Semáforo del Colaborador no es texto humano, y el
             mismo color significa cosas distintas en otros semáforos: la
             etiqueta correcta es la de ESTE semáforo. */
          options={WORKER_STATUSES.map((status) => ({
            value: status,
            label: WORKER_STATUS_LABEL[status],
          }))}
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
