import type { ChangeEvent, ReactNode } from 'react'

import type { PoolFilters as Filters } from '../types/pool.types'

import {
  CATALOG_POSITIONS,
  ENGLISH_LEVEL_LABEL,
  HIRING_MODALITIES,
  HIRING_MODALITY_LABEL,
  WORKER_ENGLISH_LEVELS,
} from '@/shared/constants/catalogs'
import { WORKER_STATUSES } from '@/shared/constants/workerStatus'

const CONTROL_CLASS =
  'rounded-full border border-line bg-surface py-3 pr-9 pl-5 text-sm text-ink focus:border-o-500 focus:outline-none'

/** Cada filtro lleva su etiqueta dentro del control, como en el diseño. */
function FilterSelect({
  label,
  value,
  anyLabel,
  options,
  onChange,
}: {
  label: string
  value: string
  anyLabel: string
  options: { value: string; label: string }[]
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void
}): ReactNode {
  return (
    <select value={value} onChange={onChange} aria-label={label} className={CONTROL_CLASS}>
      <option value="ALL">
        {label}: {anyLabel}
      </option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {label}: {option.label}
        </option>
      ))}
    </select>
  )
}

/**
 * Los cinco filtros del pool.
 *
 * Arrancan TODOS en «todos». La maqueta los dibuja con un valor puesto
 * —Posición: Housekeeper, Zona: Centro…— pero debajo enseña filas de Houseman,
 * Laundry y Chef en cinco zonas distintas: son valores de ejemplo del control,
 * no un filtro aplicado. Arrancar filtrando escondería el pool completo al
 * abrir la pantalla.
 */
export function PoolFilters({
  filters,
  zoneNames,
  onChange,
}: {
  filters: Filters
  zoneNames: string[]
  onChange: (filters: Filters) => void
}): ReactNode {
  const update =
    <K extends keyof Filters>(key: K) =>
    (event: ChangeEvent<HTMLSelectElement>): void => {
      onChange({ ...filters, [key]: event.target.value })
    }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <FilterSelect
        label="Posición"
        anyLabel="todas"
        value={filters.catalogPosition}
        onChange={update('catalogPosition')}
        options={CATALOG_POSITIONS.map((position) => ({ value: position, label: position }))}
      />

      <FilterSelect
        label="Zona"
        anyLabel="todas"
        value={filters.zoneName}
        onChange={update('zoneName')}
        options={zoneNames.map((zone) => ({ value: zone, label: zone }))}
      />

      <FilterSelect
        label="Inglés"
        anyLabel="cualquiera"
        value={filters.englishLevel}
        onChange={update('englishLevel')}
        options={WORKER_ENGLISH_LEVELS.map((level) => ({
          value: level,
          label: ENGLISH_LEVEL_LABEL[level],
        }))}
      />

      <FilterSelect
        label="Modalidad"
        anyLabel="todas"
        value={filters.hiringModality}
        onChange={update('hiringModality')}
        options={HIRING_MODALITIES.map((modality) => ({
          value: modality,
          label: HIRING_MODALITY_LABEL[modality],
        }))}
      />

      {/* El estado va con su código, que es el valor que viaja en la API. */}
      <FilterSelect
        label="Estado"
        anyLabel="todos"
        value={filters.status}
        onChange={update('status')}
        options={WORKER_STATUSES.map((status) => ({ value: status, label: status }))}
      />
    </div>
  )
}
