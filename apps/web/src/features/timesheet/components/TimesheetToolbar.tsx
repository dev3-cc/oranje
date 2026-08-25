import { cn } from '@oranje/ui'
import type { ChangeEvent, ReactNode } from 'react'

import type { TimesheetFilters as Filters } from '../types/timesheet.types'

import { Select } from '@/shared/components/Select'
import {
  COLUMN_WIDTHS,
  TIMESHEET_WEEK_STATUS_LABEL,
  TIMESHEET_WEEK_STATUSES,
} from '@/shared/constants/timesheetStatus'

const CONTROL_CLASS =
  'w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-4 transition-colors hover:border-ink-4 focus:outline-none focus-visible:border-o-500 focus-visible:ring-2 focus-visible:ring-o-500/30'

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
          <Select
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
          </Select>
        </LabeledControl>

        <LabeledControl label="Estado">
          <Select value={filters.status} onChange={update('status')} className={CONTROL_CLASS}>
            <option value="ALL">Todos los estados</option>
            {TIMESHEET_WEEK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {TIMESHEET_WEEK_STATUS_LABEL[status]}
              </option>
            ))}
          </Select>
        </LabeledControl>

        <LabeledControl label="Hotel">
          <Select
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
          </Select>
        </LabeledControl>
      </div>

      {}
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
