import { cn, MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'

import { neighborWeek, todayIso, weekContaining } from '../lib/weekNavigation'

/** Densidades de los mismos datos, no pantallas distintas. */
export type TimesheetView = 'HOURS' | 'DAYS' | 'MONTH'

const VIEWS: ReadonlyArray<{ id: TimesheetView; label: string }> = [
  { id: 'HOURS', label: 'Horas' },
  { id: 'DAYS', label: 'Días' },
  { id: 'MONTH', label: 'Mes' },
]

const PILL_CLASS =
  'cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500'

/** Horas · Días · Mes: cómo se dibuja la semana, con los mismos datos. */
export function TimesheetViewToggle({
  view,
  onChange,
}: {
  view: TimesheetView
  onChange: (view: TimesheetView) => void
}): ReactNode {
  return (
    <div
      role="group"
      aria-label="Vista"
      className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1"
    >
      {VIEWS.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={item.id === view}
          onClick={() => {
            onChange(item.id)
          }}
          className={cn(
            PILL_CLASS,
            item.id === view ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:text-ink',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

/**
 * ‹ · Hoy · ›. Camina por las semanas CON datos: un vecino sin timesheet no
 * existe, y el botón lo dice deshabilitándose en vez de llevar a una semana
 * vacía.
 */
export function WeekNavigator({
  weekStart,
  availableWeeks,
  onSelect,
}: {
  weekStart: string
  availableWeeks: string[]
  onSelect: (week: string) => void
}): ReactNode {
  const previous = neighborWeek(availableWeeks, weekStart, -1)
  const next = neighborWeek(availableWeeks, weekStart, 1)
  const currentWeek = weekContaining(availableWeeks, todayIso())

  const arrowClass =
    'flex size-9 cursor-pointer items-center justify-center rounded-lg border border-line bg-surface text-ink-2 hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-ink-4 disabled:hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500'

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Semana anterior"
        title={previous ? 'Semana anterior' : 'No hay semanas anteriores con datos'}
        disabled={previous === null}
        onClick={() => {
          if (previous) onSelect(previous)
        }}
        className={arrowClass}
      >
        <MaterialIcon name="chevron_left" className="text-xl" />
      </button>

      <button
        type="button"
        title="Ir a la semana actual"
        disabled={currentWeek === null || currentWeek === weekStart}
        onClick={() => {
          if (currentWeek) onSelect(currentWeek)
        }}
        className="cursor-pointer rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-ink-4 disabled:hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
      >
        Hoy
      </button>

      <button
        type="button"
        aria-label="Semana siguiente"
        title={next ? 'Semana siguiente' : 'No hay semanas más recientes con datos'}
        disabled={next === null}
        onClick={() => {
          if (next) onSelect(next)
        }}
        className={arrowClass}
      >
        <MaterialIcon name="chevron_right" className="text-xl" />
      </button>
    </div>
  )
}
