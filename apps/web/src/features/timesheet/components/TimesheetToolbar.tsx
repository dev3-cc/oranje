import {
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@oranje/ui'
import type { ReactNode } from 'react'

import type { TimesheetFilters as Filters } from '../types/timesheet.types'

import {
  COLUMN_WIDTHS,
  TIMESHEET_WEEK_STATUS_LABEL,
  TIMESHEET_WEEK_STATUSES,
} from '@/shared/constants/timesheetStatus'

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
    (value: string): void => {
      onChange({ ...filters, [key]: value })
    }

  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <label className="min-w-64">
          <span className="sr-only">Buscar colaborador</span>
          <Input
            type="search"
            value={filters.search}
            onChange={(event) => {
              update('search')(event.target.value)
            }}
            placeholder="Buscar colaborador…"
          />
        </label>

        <LabeledControl label="Requisición">
          <Select value={filters.requisitionNumber} onValueChange={update('requisitionNumber')}>
            <SelectTrigger aria-label="Requisición" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              {requisitionNumbers.map((number) => (
                <SelectItem key={number} value={number}>
                  {number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LabeledControl>

        <LabeledControl label="Estado">
          <Select value={filters.status} onValueChange={update('status')}>
            <SelectTrigger aria-label="Estado" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los estados</SelectItem>
              {TIMESHEET_WEEK_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {TIMESHEET_WEEK_STATUS_LABEL[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LabeledControl>

        <LabeledControl label="Hotel">
          <Select value={filters.hotelName} onValueChange={update('hotelName')}>
            <SelectTrigger aria-label="Hotel" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los hoteles</SelectItem>
              {hotelNames.map((hotel) => (
                <SelectItem key={hotel} value={hotel}>
                  {hotel}
                </SelectItem>
              ))}
            </SelectContent>
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
