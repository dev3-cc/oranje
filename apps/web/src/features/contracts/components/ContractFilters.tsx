import type { ReactNode } from 'react'

import { ANY_VALUE, type ContractListFilters } from '../types/contract.types'

import { FilterReset } from '@/shared/components/FilterReset'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { SearchField } from '@/shared/components/SearchField'
import { CONTRACT_STATUSES, EXPIRY_WINDOWS } from '@/shared/constants/contractStatus'

export function ContractFilters({
  filters,
  zoneNames,
  onChange,
  onReset,
}: {
  filters: ContractListFilters
  zoneNames: string[]
  onChange: (filters: ContractListFilters) => void
  onReset: () => void
}): ReactNode {
  const update =
    <K extends keyof ContractListFilters>(key: K) =>
    (value: ContractListFilters[K]): void => {
      onChange({ ...filters, [key]: value })
    }

  const activeCount = [
    filters.search.trim() !== '',
    filters.status !== ANY_VALUE,
    filters.zoneName !== ANY_VALUE,
    filters.expiresInDays !== null,
  ].filter(Boolean).length

  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchField
        value={filters.search}
        onChange={update('search')}
        label="Buscar contrato"
        placeholder="Hotel o número de contrato, p. ej. Puerto Real…"
        className="w-full max-w-md"
      />

      <FilterSelect
        label="Estado"
        anyLabel="todos"
        value={filters.status}
        options={CONTRACT_STATUSES.map((status) => ({ value: status, label: status }))}
        onChange={(value) => {
          update('status')(value as ContractListFilters['status'])
        }}
      />

      <FilterSelect
        label="Zona"
        anyLabel="todas"
        value={filters.zoneName}
        options={zoneNames.map((zone) => ({ value: zone, label: zone }))}
        onChange={update('zoneName')}
      />

      {/* Filtra de verdad: fuera quedan los que no vencen en ese plazo. El
          mismo plazo es el umbral de «vence en N días» de cada renglón. */}
      <FilterSelect
        icon="event"
        label="Vencimiento"
        anyLabel="todos"
        value={filters.expiresInDays === null ? ANY_VALUE : String(filters.expiresInDays)}
        options={EXPIRY_WINDOWS.map((days) => ({
          value: String(days),
          label: `en ${String(days)} días`,
        }))}
        onChange={(value) => {
          update('expiresInDays')(value === ANY_VALUE ? null : Number(value))
        }}
      />

      <FilterReset activeCount={activeCount} onReset={onReset} />
    </div>
  )
}
