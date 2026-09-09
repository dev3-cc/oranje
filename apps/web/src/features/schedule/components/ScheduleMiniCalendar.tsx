import { cn } from '@oranje/ui'
import { useMemo, type ReactNode } from 'react'

/** Piezas genéricas de navegación semanal, expuestas por el índice de Timesheet (§4). */
import { localeTag } from '@/app/i18n'
import { addDaysIso, todayIso } from '@/features/timesheet'

const WEEKDAY_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/** `2026-09` → `Septiembre 2026`. */
function monthLabel(month: string): string {
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString(localeTag(), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * El mini-calendario del panel lateral: el mes de la semana enseñada, con un
 * punto en los días que tienen schedule y el día elegido resaltado. Picar un
 * día lleva a SU semana — nunca navega de mes, sin sobre-ingeniería.
 */
export function ScheduleMiniCalendar({
  month,
  availableWeeks,
  selectedDay,
  onPickDay,
}: {
  /** `YYYY-MM` del mes a dibujar. */
  month: string
  /** Los lunes con schedule, ascendentes. */
  availableWeeks: string[]
  /** El día resaltado; `null` = ninguno. */
  selectedDay: string | null
  onPickDay: (date: string) => void
}): ReactNode {
  const today = todayIso()

  const cells = useMemo(() => {
    const first = `${month}-01`
    const firstWeekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7
    const list: Array<string | null> = Array.from({ length: firstWeekday }, () => null)
    for (let offset = 0; ; offset += 1) {
      const date = addDaysIso(first, offset)
      if (!date.startsWith(month)) break
      list.push(date)
    }
    while (list.length % 7 !== 0) list.push(null)
    return list
  }, [month])

  function hasSchedule(date: string): boolean {
    return availableWeeks.some((monday) => monday <= date && date <= addDaysIso(monday, 6))
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <p className="mb-2 text-center text-xs font-bold text-ink">{monthLabel(month)}</p>
      <div className="grid grid-cols-7 gap-y-1">
        {WEEKDAY_HEADERS.map((weekday, index) => (
          <p
            key={`${weekday}-${String(index)}`}
            className="text-center text-[10px] font-semibold text-ink-3"
          >
            {weekday}
          </p>
        ))}
        {cells.map((date, index) => {
          if (date === null) return <span key={`gap-${String(index)}`} aria-hidden />
          const withSchedule = hasSchedule(date)
          const isSelected = date === selectedDay
          const isToday = date === today
          return (
            <button
              key={date}
              type="button"
              disabled={!withSchedule}
              onClick={() => {
                onPickDay(date)
              }}
              title={
                withSchedule ? 'Ir a la semana de este día' : 'Este hotel no tiene schedule ese día'
              }
              className={cn(
                'mx-auto flex size-7 cursor-pointer items-center justify-center rounded-full text-xs font-medium transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
                isSelected
                  ? 'bg-o-500 text-ink font-bold'
                  : isToday
                    ? 'border border-o-500 text-ink'
                    : withSchedule
                      ? 'text-ink-2 hover:bg-surface-2'
                      : 'cursor-default text-ink-4',
              )}
            >
              {Number(date.slice(8, 10))}
            </button>
          )
        })}
      </div>
    </div>
  )
}
