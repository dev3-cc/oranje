import { useLingui } from '@lingui/react/macro'
import { cn, MaterialIcon } from '@oranje/ui'
import { type KeyboardEvent, type ReactNode, useEffect, useRef } from 'react'

import { weekRangeOf } from '../lib/cohortFormat'
import { addWeeks } from '../lib/cohorts'

/**
 * La línea de tiempo de Ingresos: una barra por semana con cuántos
 * empezaron a trabajar. Tocar una barra (o las flechas) mueve toda la vista a
 * esa semana; la franja sombreada son las 12 semanas que se comparan.
 */
export function CohortTimeline({
  sizes,
  selected,
  band,
  onSelect,
}: {
  /** De la semana más vieja a la más reciente. */
  sizes: Array<{ week: string; size: number }>
  selected: string
  band: { from: string; to: string }
  onSelect: (week: string) => void
}): ReactNode {
  const { i18n, t } = useLingui()
  const selectedRef = useRef<HTMLButtonElement>(null)
  const max = Math.max(1, ...sizes.map((item) => item.size))
  const first = sizes[0]?.week
  const last = sizes[sizes.length - 1]?.week

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [selected])

  const step = (weeks: number): void => {
    const next = addWeeks(selected, weeks)
    if (first && last && next >= first && next <= last) onSelect(next)
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      step(-1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      step(1)
    }
  }

  const monthOf = (week: string): string =>
    new Date(`${week}T00:00:00Z`).toLocaleDateString(i18n.locale, {
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC',
    })

  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        aria-label={t`Una semana antes`}
        disabled={!first || selected <= first}
        onClick={() => {
          step(-1)
        }}
        className="inline-flex w-10 shrink-0 items-center justify-center rounded-xl border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-40"
      >
        <MaterialIcon name="chevron_left" className="text-2xl" aria-hidden />
      </button>

      <div
        role="listbox"
        aria-label={t`Semanas de ingreso`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto rounded-xl border border-line bg-surface px-2 pt-6 pb-1 focus-visible:outline-2 focus-visible:outline-o-300"
      >
        {sizes.map((item, index) => {
          const isSelected = item.week === selected
          const inBand = item.week >= band.from && item.week <= band.to
          const startsMonth =
            index === 0 || item.week.slice(0, 7) !== sizes[index - 1]?.week.slice(0, 7)
          return (
            <button
              key={item.week}
              ref={isSelected ? selectedRef : undefined}
              type="button"
              role="option"
              aria-selected={isSelected}
              title={t`${weekRangeOf(item.week)}: ${item.size} ingresos`}
              onClick={() => {
                onSelect(item.week)
              }}
              className={cn(
                'group flex w-8 shrink-0 flex-col items-center gap-1 rounded-md pb-1',
                inBand && 'bg-o-50',
              )}
            >
              <span
                className={cn(
                  'text-[11px] tabular-nums',
                  isSelected ? 'font-bold text-ink' : 'text-ink-3',
                )}
              >
                {item.size || ''}
              </span>
              <span className="flex h-20 w-5 items-end">
                <span
                  className={cn(
                    'block w-full rounded-t-sm transition-colors',
                    isSelected ? 'bg-o-500' : 'bg-o-300/60 group-hover:bg-o-300',
                  )}
                  style={{
                    height: `${String(Math.max(item.size ? 6 : 2, (item.size / max) * 100))}%`,
                  }}
                />
              </span>
              <span
                className={cn(
                  'h-4 text-[10px] whitespace-nowrap',
                  startsMonth ? 'text-ink-2' : 'text-transparent',
                )}
              >
                {monthOf(item.week)}
              </span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        aria-label={t`Una semana después`}
        disabled={!last || selected >= last}
        onClick={() => {
          step(1)
        }}
        className="inline-flex w-10 shrink-0 items-center justify-center rounded-xl border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-40"
      >
        <MaterialIcon name="chevron_right" className="text-2xl" aria-hidden />
      </button>
    </div>
  )
}
