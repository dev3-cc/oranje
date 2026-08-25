import type { ChangeEvent, ReactNode } from 'react'

import type { ContractListFilters } from '../types/contract.types'

import { FilterSelect } from '@/shared/components/FilterSelect'
import { Select } from '@/shared/components/Select'
import { CONTRACT_STATUSES, EXPIRY_WINDOWS } from '@/shared/constants/contractStatus'

const SEARCH_CLASS =
  'rounded-full border border-line bg-surface px-5 py-2.5 text-sm text-ink transition-colors placeholder:text-ink-4 hover:bg-surface-2 focus:border-o-500 focus:outline-none'

const WINDOW_CLASS =
  'cursor-pointer rounded-full border border-line bg-surface py-2.5 pl-4 text-sm text-ink transition-colors hover:bg-surface-2 focus:border-o-500 focus:outline-none'

export function ContractFilters({
  filters,
  zoneNames,
  warningDays,
  onChange,
  onWarningDaysChange,
}: {
  filters: ContractListFilters
  zoneNames: string[]
  warningDays: number
  onChange: (filters: ContractListFilters) => void
  onWarningDaysChange: (days: number) => void
}): ReactNode {
  const update =
    <K extends keyof ContractListFilters>(key: K) =>
    (value: string): void => {
      onChange({ ...filters, [key]: value as ContractListFilters[K] })
    }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <input
        type="search"
        value={filters.search}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          update('search')(event.target.value)
        }}
        placeholder="Buscar por hotel o número…"
        aria-label="Buscar por hotel o número"
        className={`${SEARCH_CLASS} min-w-72 flex-1`}
      />

      <FilterSelect
        label="Estado"
        anyLabel="todos"
        value={filters.status}
        options={CONTRACT_STATUSES.map((status) => ({ value: status, label: status }))}
        onChange={update('status')}
      />

      <FilterSelect
        label="Zona"
        anyLabel="todas"
        value={filters.zoneName}
        options={zoneNames.map((zone) => ({ value: zone, label: zone }))}
        onChange={update('zoneName')}
      />

      <Select
        value={warningDays}
        onChange={(event) => {
          onWarningDaysChange(Number(event.target.value))
        }}
        aria-label="Avisar cuando falten"
        className={WINDOW_CLASS}
      >
        {EXPIRY_WINDOWS.map((days) => (
          <option key={days} value={days}>
            Vence en: {days} días
          </option>
        ))}
      </Select>
    </div>
  )
}
