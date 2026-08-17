import type { ChangeEvent, ReactNode } from 'react'

import {
  CLIENT_SORT_LABEL,
  CLIENT_SORTS,
  type ClientFilters as Filters,
} from '../types/client.types'

import { CONTRACT_STATUSES } from '@/shared/constants/contractStatus'

const CONTROL_CLASS =
  'rounded-full border border-line bg-surface px-5 py-3 text-sm text-ink focus:border-o-500 focus:outline-none'

/**
 * Los cinco controles de la cartera. Todos filtran u ordenan en el SERVIDOR:
 * la cartera es de doce hoteles hoy y de cientos el año que viene, y ordenar
 * solo lo descargado pondría al final una página que no lo es.
 */
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
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
      onChange({ ...filters, [key]: event.target.value as Filters[K] })
    }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <input
        type="search"
        value={filters.search}
        onChange={update('search')}
        placeholder="Buscar hotel…"
        aria-label="Buscar hotel"
        className={`${CONTROL_CLASS} min-w-64 placeholder:text-ink-4`}
      />

      <select
        value={filters.zoneName}
        onChange={update('zoneName')}
        aria-label="Zona"
        className={CONTROL_CLASS}
      >
        <option value="ALL">Zona: todas</option>
        {zoneNames.map((zone) => (
          <option key={zone} value={zone}>
            Zona: {zone}
          </option>
        ))}
      </select>

      <select
        value={filters.contractStatus}
        onChange={update('contractStatus')}
        aria-label="Contrato"
        className={CONTROL_CLASS}
      >
        <option value="ALL">Contrato: todos</option>
        {CONTRACT_STATUSES.map((status) => (
          <option key={status} value={status}>
            Contrato: {status}
          </option>
        ))}
      </select>

      <select
        value={filters.activationYear}
        onChange={update('activationYear')}
        aria-label="Cliente desde"
        className={CONTROL_CLASS}
      >
        <option value="ALL">Cliente desde: siempre</option>
        {activationYears.map((year) => (
          <option key={year} value={String(year)}>
            Cliente desde: {year}
          </option>
        ))}
      </select>

      {/* El orden se va al extremo opuesto: no filtra, así que no es del grupo. */}
      <select
        value={filters.sort}
        onChange={update('sort')}
        aria-label="Ordenar"
        className={`${CONTROL_CLASS} ml-auto`}
      >
        {CLIENT_SORTS.map((sort) => (
          <option key={sort} value={sort}>
            Ordenar: {CLIENT_SORT_LABEL[sort]}
          </option>
        ))}
      </select>
    </div>
  )
}
