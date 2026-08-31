import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@oranje/ui'
import { Input } from '@oranje/ui'
import type { ChangeEvent, ReactNode } from 'react'

import type { ContractListFilters } from '../types/contract.types'

import { FilterSelect } from '@/shared/components/FilterSelect'
import { CONTRACT_STATUSES, EXPIRY_WINDOWS } from '@/shared/constants/contractStatus'

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
      <Input
        type="search"
        value={filters.search}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          update('search')(event.target.value)
        }}
        placeholder="Hotel Puerto Real o CT-2026-0184"
        aria-label="Buscar por hotel o número"
        className="h-auto min-w-72 flex-1 rounded-full px-5 py-2.5 hover:bg-surface-2"
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
        value={String(warningDays)}
        onValueChange={(value) => {
          onWarningDaysChange(Number(value))
        }}
      >
        <SelectTrigger aria-label="Avisar cuando falten" className="rounded-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {EXPIRY_WINDOWS.map((days) => (
            <SelectItem key={days} value={String(days)}>
              Vence en: {days} días
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
