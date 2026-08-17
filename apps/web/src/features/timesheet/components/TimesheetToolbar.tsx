import { cn } from '@oranje/ui'
import type { ChangeEvent, ReactNode } from 'react'

import type { TimesheetFilters as Filters } from '../types/timesheet.types'

import {
  COLUMN_WIDTHS,
  TIMESHEET_STATUS_LABEL,
  TIMESHEET_STATUSES,
} from '@/shared/constants/timesheetStatus'

const CONTROL_CLASS =
  'w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none'

/** Etiqueta arriba del control, como en el diseño. */
function LabeledControl({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <label className="flex min-w-48 flex-col gap-1.5">
      <span className="text-xs text-ink-3">{label}</span>
      {children}
    </label>
  )
}

export function TimesheetToolbar({
  filters,
  requisitionNumbers,
  hotelNames,
  columnWidth,
  onChange,
  onColumnWidthChange,
}: {
  filters: Filters
  requisitionNumbers: string[]
  hotelNames: string[]
  columnWidth: number
  onChange: (filters: Filters) => void
  onColumnWidthChange: (width: number) => void
}): ReactNode {
  const update =
    <K extends keyof Filters>(key: K) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
      onChange({ ...filters, [key]: event.target.value })
    }

  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <label className="min-w-64">
          <span className="sr-only">Buscar colaborador</span>
          <input
            type="search"
            value={filters.search}
            onChange={update('search')}
            placeholder="Buscar colaborador…"
            className={CONTROL_CLASS}
          />
        </label>

        <LabeledControl label="Requisición">
          <select
            value={filters.requisitionNumber}
            onChange={update('requisitionNumber')}
            className={CONTROL_CLASS}
          >
            <option value="ALL">Todas</option>
            {requisitionNumbers.map((number) => (
              <option key={number} value={number}>
                {number}
              </option>
            ))}
          </select>
        </LabeledControl>

        <LabeledControl label="Estado">
          <select value={filters.status} onChange={update('status')} className={CONTROL_CLASS}>
            <option value="ALL">Todos los estados</option>
            {TIMESHEET_STATUSES.map((status) => (
              <option key={status} value={status}>
                {TIMESHEET_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </LabeledControl>

        <LabeledControl label="Hotel">
          <select
            value={filters.hotelName}
            onChange={update('hotelName')}
            className={CONTROL_CLASS}
          >
            <option value="ALL">Todos los hoteles</option>
            {hotelNames.map((hotel) => (
              <option key={hotel} value={hotel}>
                {hotel}
              </option>
            ))}
          </select>
        </LabeledControl>
      </div>

      {/*
        El zoom NO filtra: cambia cuántos días caben sin hacer scroll. Con 90 px
        entra la semana completa en una pantalla estrecha; con 180, cada día se
        lee sin achicar el texto.
      */}
      <div className="flex flex-col items-end gap-1.5">
        <span className="text-xs text-ink-3">Zoom · ancho de columna</span>
        <div
          role="group"
          aria-label="Ancho de columna"
          className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1"
        >
          {COLUMN_WIDTHS.map((width) => (
            <button
              key={width}
              type="button"
              aria-pressed={width === columnWidth}
              onClick={() => {
                onColumnWidthChange(width)
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
                width === columnWidth ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:text-ink',
              )}
            >
              {width}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
