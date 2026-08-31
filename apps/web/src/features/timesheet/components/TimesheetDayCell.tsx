import { cn, statusLight } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { TimesheetEntry } from '../types/timesheet.types'

import {
  PUNCH_STATE_LABEL,
  TIMESHEET_STATUS_LABEL,
  TIMESHEET_STATUS_TOKEN,
} from '@/shared/constants/timesheetStatus'
import { formatHours } from '@/shared/lib/formatters'

/** Horas todavía sin calcular: guion largo, que no es lo mismo que cero. */
const NO_HOURS = '—'

/** Cómo se dibuja el punto de checadas según su estado. */
const PUNCH_CLASS = {
  COMPLETE: 'border-transparent',
  INCOMPLETE: 'border-ink-4 bg-transparent',
  NO_SHIFT: 'border-dashed border-ink-4 bg-transparent',
} as const

/**
 * Un día de una persona.
 *
 * Lleva DOS indicadores y no uno, porque son dos preguntas distintas: el punto
 * de la izquierda dice si marcó entrada y salida, y el chip de color dice si
 * alguien ya revisó lo que marcó. Un día puede tener las checadas completas y
 * seguir sin revisar.
 *
 * La casilla morada es la selección para actuar en bloque — pagar, revisar—, y
 * por eso comparte el color con el resumen de la selección.
 */
export function TimesheetDayCell({
  entry,
  isSelected,
  onToggle,
  onReview,
}: {
  entry: TimesheetEntry
  isSelected: boolean
  onToggle: (entryId: string) => void
  /** Abre la Revisión del día (maqueta del Supervisor). */
  onReview: (entry: TimesheetEntry) => void
}): ReactNode {
  const color = statusLight[TIMESHEET_STATUS_TOKEN[entry.status]]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-center gap-2">
        <span
          title={PUNCH_STATE_LABEL[entry.punch]}
          aria-label={PUNCH_STATE_LABEL[entry.punch]}
          role="img"
          className={cn('size-3.5 rounded-full border-2', PUNCH_CLASS[entry.punch])}
          style={
            entry.punch === 'COMPLETE' ? { backgroundColor: statusLight['st-verde'] } : undefined
          }
        />

        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {
            onToggle(entry.id)
          }}
          aria-label={`Seleccionar ${entry.date}`}
          className="size-3.5 appearance-none rounded-full border-2 border-purple checked:bg-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple"
        />
      </div>

      <button
        type="button"
        onClick={() => {
          onReview(entry)
        }}
        title="Revisar el día"
        className={cn(
          'w-full cursor-pointer rounded-lg p-3 text-left transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
          isSelected && 'ring-2 ring-purple',
        )}
        style={{ backgroundColor: `${color}26` }}
      >
        <p className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-ink-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <span className="truncate">{TIMESHEET_STATUS_LABEL[entry.status]}</span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-ink-2">
            {entry.hours === null ? NO_HOURS : formatHours(entry.hours)}
          </span>
        </p>

        <p className="mt-1.5 truncate text-xs text-ink-3">
          {entry.startTime === null || entry.endTime === null
            ? NO_HOURS
            : `${entry.startTime} – ${entry.endTime}`}
        </p>
        <p className="mt-0.5 truncate text-xs font-medium text-ink-3">
          {entry.requisitionNumber ?? 'Sin requisición'}
        </p>
      </button>
    </div>
  )
}
