import { cn, statusLight } from '@oranje/ui'
import { useMemo, type ReactNode } from 'react'

import { addDaysIso, todayIso } from '../lib/weekNavigation'
import type { TimesheetMonth, TimesheetMonthDay } from '../types/timesheet.types'

import { formatHours } from '@/shared/lib/formatters'

const WEEKDAY_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** `2026-09` → `septiembre 2026`, con mayúscula inicial. */
function monthLabel(month: string): string {
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString('es', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Contador de estado: punto de color + número, nunca el color solo. */
function StatusCount({
  token,
  count,
  label,
}: {
  token: keyof typeof statusLight
  count: number
  label: string
}): ReactNode {
  if (count === 0) return null
  return (
    <span className="inline-flex items-center gap-1" title={`${String(count)} ${label}`}>
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: statusLight[token] }}
        aria-hidden
      />
      <span className="text-[10px] font-semibold text-ink-2">{count}</span>
    </span>
  )
}

/**
 * La vista Mes: cada día con actividad enseña sus horas netas, cuántas
 * personas trabajaron y el conteo por estado de revisión. Picar un día lleva a
 * su semana en la vista Días — el mes localiza, la semana opera.
 */
export function TimesheetMonthView({
  month,
  onPickDay,
}: {
  month: TimesheetMonth
  onPickDay: (date: string) => void
}): ReactNode {
  const today = todayIso()
  const byDate = useMemo(() => new Map(month.days.map((day) => [day.date, day])), [month])

  const cells = useMemo(() => {
    if (month.month === '') return []
    const first = `${month.month}-01`
    const firstWeekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7
    const list: Array<string | null> = Array.from({ length: firstWeekday }, () => null)
    for (let offset = 0; ; offset += 1) {
      const date = addDaysIso(first, offset)
      if (!date.startsWith(month.month)) break
      list.push(date)
    }
    while (list.length % 7 !== 0) list.push(null)
    return list
  }, [month])

  if (month.month === '' || month.days.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
        Este mes no tiene jornadas registradas. Navega con ‹ › a una semana con datos.
      </p>
    )
  }

  return (
    /* El mes no tiene columna fija: la hoja completa se desliza con el gesto. */
    /* En pantallas chicas el mes scrollea DENTRO de su tarjeta (patrón de
       Días y Horas): el cuerpo de la página nunca scrollea horizontal. */
    <div
      className="overflow-hidden rounded-lg border border-line bg-surface"
      style={{ transform: 'translateX(var(--week-drag-x, 0px))' }}
    >
      <div>
        <p className="border-b border-line px-5 py-3 text-sm font-bold text-ink">
          {monthLabel(month.month)}
        </p>

        <div className="grid grid-cols-7 border-b border-line">
          {WEEKDAY_HEADERS.map((weekday) => (
            <p
              key={weekday}
              className="border-l border-line px-2 py-2 text-center text-xs text-ink-3 first:border-l-0"
            >
              {weekday}
            </p>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((date, index) => {
            if (date === null) {
              return (
                <div
                  // Huecos de relleno del principio y el fin del mes: la posición es la llave.
                  key={`gap-${String(index)}`}
                  className={cn(
                    'min-h-12 border-t border-l border-line bg-surface-2/50 sm:min-h-16',
                    index % 7 === 0 && 'border-l-0',
                  )}
                />
              )
            }

            const aggregate: TimesheetMonthDay | undefined = byDate.get(date)
            const weekday = index % 7
            const isWeekend = weekday >= 5
            const isToday = date === today
            const dayNumber = String(Number(date.slice(8, 10)))

            return (
              <button
                key={date}
                type="button"
                disabled={aggregate === undefined}
                onClick={() => {
                  onPickDay(date)
                }}
                title={
                  aggregate === undefined
                    ? 'Sin jornadas este día'
                    : 'Abrir la semana de este día en la vista Días'
                }
                className={cn(
                  'flex min-h-12 flex-col items-start gap-1 border-t border-l border-line p-1 text-left sm:min-h-16 sm:p-2',
                  weekday === 0 && 'border-l-0',
                  isToday ? 'bg-o-500/5' : isWeekend && 'bg-ink/5',
                  aggregate !== undefined
                    ? 'cursor-pointer transition-colors hover:bg-o-500/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-o-500'
                    : 'cursor-default',
                )}
              >
                <span
                  className={cn(
                    'text-sm font-semibold',
                    isToday
                      ? 'rounded-md bg-o-500 px-1.5 text-ink'
                      : aggregate !== undefined
                        ? 'text-ink-2'
                        : /* Un día sin actividad baja la voz: el número no compite. */
                          'text-ink-4',
                  )}
                >
                  {dayNumber}
                </span>

                {aggregate !== undefined && (
                  <>
                    <span className="text-[10px] font-bold text-ink sm:text-xs">
                      {formatHours(aggregate.netHours)}
                      {/* El detalle fino solo donde cabe: en xs el mes localiza,
                          la semana opera (mini-calendario, no scroll lateral). */}
                      <span className="ml-1 hidden font-normal text-ink-3 sm:inline">
                        · {aggregate.people} pers.
                      </span>
                    </span>
                    <span className="hidden flex-wrap items-center gap-2 sm:flex">
                      <StatusCount
                        token="st-azul-claro"
                        count={aggregate.pending}
                        label="pendientes"
                      />
                      <StatusCount
                        token="st-amarillo"
                        count={aggregate.observed}
                        label="observados"
                      />
                      <StatusCount token="st-morado" count={aggregate.reviewed} label="revisados" />
                      {aggregate.absences > 0 && (
                        <span className="text-[10px] text-ink-3" title="Ausencias">
                          {aggregate.absences} aus.
                        </span>
                      )}
                    </span>
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
