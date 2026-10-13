import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import {
  ANY_VALUE,
  EMPTY_POOL_FILTERS,
  PENDING_VALUE,
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
  /* Seis píldoras + buscador apiladas ocupaban la pantalla entera en móvil
     antes de ver un solo colaborador (Hugo, 2026-10-12, con captura del
     Timesheet — mismo problema aquí). Mismo patrón: un botón «Filtrar» las
     oculta, y con algo puesto se quedan abiertas para poder quitarlo; desde
     `lg` siguen en su banda de siempre, sin tocar nada. */
  const [isFiltersOpen, setFiltersOpen] = useState(false)
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
    filters.hasPendingDocument !== ANY_VALUE,
  ].filter(Boolean).length
  const showFiltersOnMobile = isFiltersOpen || activeCount > 0

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={showFiltersOnMobile}
        onClick={() => {
          setFiltersOpen((open) => !open)
        }}
        className="flex w-full cursor-pointer items-center justify-between gap-2 text-sm font-semibold text-ink lg:hidden"
      >
        <span className="flex items-center gap-1.5">
          <MaterialIcon name="filter_list" className="text-base" aria-hidden />
          <Trans>Filtrar</Trans>
          {activeCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-o-500 text-xs font-bold text-ink">
              {activeCount}
            </span>
          )}
        </span>
        <MaterialIcon
          name={showFiltersOnMobile ? 'expand_less' : 'expand_more'}
          className="text-xl text-ink-3"
          aria-hidden
        />
      </button>

      <div
        className={
          showFiltersOnMobile
            ? 'flex flex-col gap-3 lg:flex'
            : 'hidden lg:flex lg:flex-col lg:gap-3'
        }
      >
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

          <FilterSelect
            icon="warning_amber"
            label={t`Documento`}
            anyLabel={t`cualquiera`}
            value={filters.hasPendingDocument}
            onChange={update('hasPendingDocument')}
            options={[{ value: PENDING_VALUE, label: t`Pendiente de verificar` }]}
          />

          <FilterReset
            activeCount={activeCount}
            onReset={() => {
              onChange(EMPTY_POOL_FILTERS)
            }}
          />
        </div>
      </div>
    </div>
  )
}
