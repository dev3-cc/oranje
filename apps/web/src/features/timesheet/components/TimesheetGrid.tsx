import type { ReactNode } from 'react'

import type { TimesheetEntry, TimesheetRow, TimesheetWeek } from '../types/timesheet.types'

import { TimesheetDayCell } from './TimesheetDayCell'
import { WorkerWeekSummary } from './WorkerWeekSummary'

import { formatDayNumber, formatWeekday } from '@/shared/lib/formatters'

/** Ancho de la columna fija de colaboradores. */
const WORKER_COLUMN_PX = 260

/**
 * La rejilla de la semana: una fila por persona, una columna por día.
 *
 * Se arma con `grid-template-columns` y no con una `<table>` porque el ancho de
 * las columnas de día lo elige el usuario con el zoom, y una tabla reparte el
 * sobrante a su manera en cuanto el contenido no cabe.
 *
 * El encabezado sale de `week.days`, así que columnas y título siempre hablan
 * de las mismas fechas.
 */
export function TimesheetGrid({
  week,
  columnWidth,
  selectedIds,
  onToggle,
  onReview,
  onManualPunch,
}: {
  week: TimesheetWeek
  columnWidth: number
  selectedIds: Set<string>
  onToggle: (entryId: string) => void
  onReview: (entry: TimesheetEntry, workerName: string) => void
  onManualPunch: (row: TimesheetRow) => void
}): ReactNode {
  const template = `${String(WORKER_COLUMN_PX)}px repeat(${String(week.days.length)}, ${String(columnWidth)}px)`

  if (week.rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
        Nadie coincide con el filtro esta semana.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <div className="min-w-max">
        <div
          className="grid items-end border-b border-line"
          style={{ gridTemplateColumns: template }}
        >
          <div className="px-5 py-4 text-xs font-semibold tracking-wide text-ink-3 uppercase">
            Colaborador
          </div>
          {week.days.map((day) => (
            <div key={day} className="px-2 py-3 text-center">
              <p className="text-xs text-ink-3">{formatWeekday(day)}</p>
              <p className="text-xl font-semibold text-ink">{formatDayNumber(day)}</p>
            </div>
          ))}
        </div>

        {week.rows.map((row) => {
          const byDate = new Map(row.entries.map((item) => [item.date, item]))

          return (
            <div
              key={row.workerId}
              className="grid items-start border-b border-line last:border-b-0"
              style={{ gridTemplateColumns: template }}
            >
              <div className="px-5 py-4">
                <WorkerWeekSummary row={row} onManualPunch={onManualPunch} />
              </div>

              {week.days.map((day) => {
                const entry = byDate.get(day)

                return (
                  <div key={day} className="px-2 py-4">
                    {/* Un día sin registro se deja VACÍO, no con una tarjeta en
                        cero: nadie fichó, y dibujar algo sugiere lo contrario. */}
                    {entry && (
                      <TimesheetDayCell
                        entry={entry}
                        isSelected={selectedIds.has(entry.id)}
                        onToggle={onToggle}
                        onReview={(item) => {
                          onReview(item, row.workerName)
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
