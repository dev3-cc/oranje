import type { ChangeEvent, ReactNode } from 'react'

import type { ContractListFilters } from '../types/contract.types'

import { CONTRACT_STATUSES, EXPIRY_WINDOWS } from '@/shared/constants/contractStatus'

const CONTROL_CLASS =
  'rounded-full border border-line bg-surface px-5 py-3 text-sm text-ink focus:border-o-500 focus:outline-none'

/**
 * Los cuatro controles de la lista.
 *
 * Tres filtran en el servidor —búsqueda, estado y zona— y el cuarto no filtra
 * nada: «Vence en» decide a partir de cuándo un contrato se marca como próximo
 * a vencer. Por eso con 90 días a la vista siguen apareciendo contratos a diez
 * meses; lo que cambia es a cuáles se les grita.
 */
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
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
      onChange({ ...filters, [key]: event.target.value as ContractListFilters[K] })
    }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <input
        type="search"
        value={filters.search}
        onChange={update('search')}
        placeholder="Buscar por hotel o número…"
        aria-label="Buscar por hotel o número"
        className={`${CONTROL_CLASS} min-w-72 flex-1 placeholder:text-ink-4`}
      />

      <select
        value={filters.status}
        onChange={update('status')}
        aria-label="Estado"
        className={CONTROL_CLASS}
      >
        <option value="ALL">Estado: todos</option>
        {CONTRACT_STATUSES.map((status) => (
          <option key={status} value={status}>
            Estado: {status}
          </option>
        ))}
      </select>

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
        value={warningDays}
        onChange={(event) => {
          onWarningDaysChange(Number(event.target.value))
        }}
        aria-label="Avisar cuando falten"
        className={CONTROL_CLASS}
      >
        {EXPIRY_WINDOWS.map((days) => (
          <option key={days} value={days}>
            Vence en: {days} días
          </option>
        ))}
      </select>
    </div>
  )
}
