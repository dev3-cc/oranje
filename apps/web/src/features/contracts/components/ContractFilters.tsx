import { useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'

import { ANY_VALUE, type ContractListFilters } from '../types/contract.types'

import { FilterReset } from '@/shared/components/FilterReset'
import { FilterSelect } from '@/shared/components/FilterSelect'
import {
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUSES,
  EXPIRY_WINDOWS,
} from '@/shared/constants/contractStatus'

/** El buscador por hotel vive siempre visible en `ContractListPage`, no
    aquí adentro (Hugo, 2026-10-21): escondido detrás de «Filtrar» no se
    encontraba. `filters.search` se sigue leyendo para que «Quitar filtros»
    también lo limpie. */
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
  const { t } = useLingui()

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
      <FilterSelect
        label={t`Estado`}
        anyLabel={t`todos`}
        value={filters.status}
        options={CONTRACT_STATUSES.map((status) => ({
          value: status,
          label: CONTRACT_STATUS_LABEL[status],
        }))}
        onChange={(value) => {
          update('status')(value as ContractListFilters['status'])
        }}
      />

      <FilterSelect
        label={t`Zona`}
        anyLabel={t`todas`}
        value={filters.zoneName}
        options={zoneNames.map((zone) => ({ value: zone, label: zone }))}
        onChange={update('zoneName')}
      />

      {/* Filtra de verdad: fuera quedan los que no vencen en ese plazo. El
          mismo plazo es el umbral de «vence en N días» de cada renglón. */}
      <FilterSelect
        icon="event"
        label={t`Vencimiento`}
        anyLabel={t`todos`}
        value={filters.expiresInDays === null ? ANY_VALUE : String(filters.expiresInDays)}
        options={EXPIRY_WINDOWS.map((days) => ({
          value: String(days),
          label: t`en ${String(days)} días`,
        }))}
        onChange={(value) => {
          update('expiresInDays')(value === ANY_VALUE ? null : Number(value))
        }}
      />

      <FilterReset activeCount={activeCount} onReset={onReset} />
    </div>
  )
}
