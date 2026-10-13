import { Trans, useLingui } from '@lingui/react/macro'
import {
  cn,
  MaterialIcon,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@oranje/ui'
import { useContext, useState, type ReactNode } from 'react'

import { closingDateOf, hoursOf, mondayOf, money } from '../lib/settlementFormat'
import type {
  AccountingTimelineRow,
  AccountingTimesheetTimeline,
} from '../types/accountingTimeline.types'

import type { PayOverrideTarget } from './PayOverrideDialog'

// eslint-disable-next-line no-restricted-imports
import { TimesheetDayCell } from '@/features/timesheet/components/TimesheetDayCell'
// eslint-disable-next-line no-restricted-imports
import { WeekDragContext } from '@/features/timesheet/components/WeekSlider'
import { Button as MovingBorderBox } from '@/shared/components/MovingBorder'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  TIMESHEET_WEEK_STATUS_LABEL,
  TIMESHEET_WEEK_STATUS_TOKEN,
  type TimesheetWeekStatus,
} from '@/shared/constants/timesheetStatus'
import { formatDayMonth, formatDayNumber, formatWeekday } from '@/shared/lib/formatters'
import { MOTION } from '@/shared/lib/motion'

/** Hoy en naranja suave, fin de semana en gris — mismo criterio que el staff. */
function dayTint(day: string, today: string): string {
  if (day === today) return 'bg-o-500/5'
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
  return weekday === 0 || weekday === 6 ? 'bg-ink/5' : ''
}

function todayIso(): string {
  return new Intl.DateTimeFormat('sv-SE').format(new Date())
}

/**
 * Los tramos de días consecutivos CON hoja, dentro de `days`. Cada fila es ya
 * una sola requisición (a diferencia del Timesheet del staff, que agrupa por
 * persona y mezcla varias) — el tramo aquí no distingue de quién es, solo
 * dónde hay hueco (descanso) y dónde no.
 */
function runStarts(days: string[], hasEntry: (day: string) => boolean): Map<string, number> {
  const starts = new Map<string, number>()
  let index = 0
  while (index < days.length) {
    if (!hasEntry(days[index] as string)) {
      index += 1
      continue
    }
    const start = index
    while (index < days.length && hasEntry(days[index] as string)) index += 1
    starts.set(days[start] as string, index - start)
  }
  return starts
}

/** El resumen de pago de la fila, para la semana elegida. */
function RowSummary({
  row,
  selectedWeek,
  canOverride,
  onCorrect,
}: {
  row: AccountingTimelineRow
  selectedWeek: string
  canOverride: boolean
  onCorrect: (target: PayOverrideTarget) => void
}): ReactNode {
  const { t } = useLingui()
  const week = row.byWeek[selectedWeek]

  if (!week) {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <p className="truncate text-sm font-bold text-ink-3">{row.workerName}</p>
        <p className="truncate text-xs text-ink-4">{row.hotelName}</p>
        <p className="text-xs text-ink-4">
          <Trans>Sin hoja esta semana</Trans>
        </p>
      </div>
    )
  }

  const code = week.weekStatus as TimesheetWeekStatus

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-ink">{row.workerName}</p>
        <p className="truncate text-xs text-ink-3">
          {row.hotelName} · {row.requisitionFolio}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <StatusLightSoftBadge
          token={TIMESHEET_WEEK_STATUS_TOKEN[code] ?? 'st-gris'}
          label={TIMESHEET_WEEK_STATUS_LABEL[code] ?? week.weekStatus}
        />
        {/* El rate interno del colaborador, cuando aplica (personal.worker_rate sin
            concepto): no es el del contrato y nunca cambia el subtotal — solo avisa que
            esta cifra no sale del hotel. El concepto extra tipo «Uber» no se muestra: no
            tiene ni alta ni pantalla todavía (Hugo, 2026-10-08). */}
        {week.isInternalRate && (
          <span
            className="inline-flex w-fit items-center gap-1 rounded-md bg-o-50 px-1.5 py-0.5 text-[11px] font-semibold text-o-700"
            title={t`Tarifa interna del colaborador — no es la del contrato de este hotel`}
          >
            <MaterialIcon name="badge" className="text-xs" aria-hidden />
            <Trans>Tarifa interna</Trans>
          </span>
        )}
      </div>
      <p className="text-[11px] text-ink-4">
        <Trans>Cierra el {formatDayMonth(closingDateOf(selectedWeek))}</Trans>
      </p>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-ink-3">
        <span>{hoursOf(week.regularMinutes)}</span>
        {week.overtimeMinutes > 0 && (
          <span className="font-semibold" style={{ color: 'var(--yellow)' }}>
            +{hoursOf(week.overtimeMinutes)}
          </span>
        )}
        <span className="font-semibold text-ink">{week.subtotal ? money(week.subtotal) : '—'}</span>
      </div>
      {canOverride && (
        <button
          type="button"
          onClick={() => {
            onCorrect({
              timesheetId: week.timesheetId,
              workerName: row.workerName,
              regularMinutes: week.regularMinutes,
              overtimeMinutes: week.overtimeMinutes,
              payRate: week.payRate,
              isOverridden: week.isOverridden,
              overrideReason: week.overrideReason,
            })
          }}
          className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-o-700 transition-colors hover:bg-o-50"
        >
          <MaterialIcon name="edit" className="text-sm" aria-hidden />
          {week.isOverridden ? <Trans>Corregido</Trans> : <Trans>Corregir</Trans>}
        </button>
      )}
    </div>
  )
}

/**
 * La cinta de días de Contabilidad: la misma física de arrastre que el
 * Timesheet del hotel (`WeekSlider`, sin tocarlo), con su propia fila —
 * identidad + pago de la semana a la izquierda, días continuos a la derecha.
 * Pieza nueva y separada a propósito (Hugo, 2026-10-08): la del staff no se
 * toca, y esta no necesita selección en bloque ni marca manual.
 */
export function AccountingTimesheetGrid({
  timeline,
  selectedWeek,
  columnWidth,
  canOverride,
  onCorrect,
}: {
  timeline: AccountingTimesheetTimeline
  /** Lunes ISO de la semana en la ventana. */
  selectedWeek: string
  columnWidth: number
  canOverride: boolean
  onCorrect: (target: PayOverrideTarget) => void
}): ReactNode {
  const { t } = useLingui()
  const { isDragging } = useContext(WeekDragContext)
  const [litRunKey, setLitRunKey] = useState<string | null>(null)
  const today = todayIso()

  const baseIndex = Math.max(timeline.days.indexOf(selectedWeek), 0)
  const weekDays = timeline.days.slice(baseIndex, baseIndex + 7)
  const viewportWidth = 7 * columnWidth
  const sheetStyle = {
    gridTemplateColumns: `repeat(${String(timeline.days.length)}, ${String(columnWidth)}px)`,
    transform: `translateX(calc(${String(-baseIndex * columnWidth)}px + var(--week-drag-x, 0px)))`,
    transition: isDragging
      ? 'none'
      : `transform ${String(MOTION.enter * 1000)}ms cubic-bezier(0, 0, 0.2, 1)`,
  }

  if (timeline.rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
        <Trans>Todavía no hay timesheets.</Trans>
      </p>
    )
  }

  return (
    <>
      {/* ——— MÓVIL: tarjetas apiladas + tira de días con snap. ——— */}
      <div className="flex flex-col gap-4 lg:hidden">
        {timeline.rows.map((row) => {
          const byDate = new Map(row.entries.map((item) => [item.date, item]))
          const daysWithEntry = weekDays.filter((day) => byDate.has(day))

          return (
            <section
              key={`${row.workerId}|${row.requisitionId}`}
              className="flex flex-col gap-2 rounded-xl border border-line p-3"
            >
              <RowSummary
                row={row}
                selectedWeek={selectedWeek}
                canOverride={canOverride}
                onCorrect={onCorrect}
              />
              {daysWithEntry.length > 0 && (
                <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
                  {weekDays.map((day) => {
                    const entry = byDate.get(day)
                    if (entry === undefined) return null
                    return (
                      <li
                        key={day}
                        className="w-44 shrink-0 snap-start rounded-xl border border-line bg-surface p-2"
                      >
                        <p className="mb-1 px-1 text-[11px] font-semibold text-ink-3">
                          {formatWeekday(day)} {formatDayNumber(day)}
                        </p>
                        <TimesheetDayCell
                          entry={entry}
                          isSelected={false}
                          selectable={false}
                          onToggle={() => {}}
                          onReview={() => {}}
                        />
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      {/* ——— ESCRITORIO: la cinta continua ——— */}
      <div className="hidden w-fit max-w-full overflow-x-auto rounded-lg border border-line bg-surface lg:block">
        <div className="min-w-max">
          <div className="flex border-b border-line">
            <div className="sticky left-0 z-20 flex w-52 shrink-0 items-end border-r border-line bg-surface px-4 py-4 text-xs font-semibold tracking-wide text-ink-3 uppercase lg:w-[260px]">
              <Trans>Colaborador</Trans>
            </div>
            <div className="overflow-hidden" style={{ width: viewportWidth }}>
              <div className="grid h-full items-end" style={sheetStyle}>
                {timeline.days.map((day) => (
                  <div
                    key={day}
                    className={cn(
                      'self-stretch border-l border-line px-2 py-3 text-center',
                      dayTint(day, today),
                    )}
                  >
                    <p className="text-xs text-ink-3">{formatWeekday(day)}</p>
                    <p
                      className={cn(
                        'mx-auto w-9 rounded-lg text-xl font-semibold',
                        day === today ? 'bg-o-500 text-ink' : 'text-ink',
                      )}
                    >
                      {formatDayNumber(day)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {timeline.rows.map((row) => {
            const byDate = new Map(row.entries.map((item) => [item.date, item]))
            const runs = runStarts(timeline.days, (day) => byDate.has(day))

            return (
              <div
                key={`${row.workerId}|${row.requisitionId}`}
                className="flex border-b border-line last:border-b-0"
              >
                <div className="sticky left-0 z-20 w-52 shrink-0 border-r border-line bg-surface px-3 py-3 lg:w-[260px]">
                  <RowSummary
                    row={row}
                    selectedWeek={selectedWeek}
                    canOverride={canOverride}
                    onCorrect={onCorrect}
                  />
                </div>

                <div className="overflow-hidden" style={{ width: viewportWidth }}>
                  <div className="grid h-full items-start" style={sheetStyle}>
                    {timeline.days.map((day) => {
                      const entry = byDate.get(day)
                      const runLength = runs.get(day)
                      const runKey = `${row.workerId}|${row.requisitionId}|${day}`
                      const isRunLit = litRunKey === runKey

                      return (
                        <div
                          key={day}
                          className={cn(
                            'self-stretch border-l border-line px-2 py-4',
                            dayTint(day, today),
                          )}
                        >
                          {entry && (
                            <div
                              className="relative"
                              /* El marco vive fuera del flujo del click (ver el
                                 span `pointer-events-none` abajo), así que el
                                 hover se escucha aquí, en el contenedor real —
                                 mismo motivo por el que `TimesheetGrid` lo hace
                                 en SU contenedor y no en el span del marco. */
                              onMouseEnter={() => {
                                setLitRunKey(runKey)
                              }}
                              onMouseLeave={() => {
                                setLitRunKey((current) => (current === runKey ? null : current))
                              }}
                            >
                              {/* La cinta naranja: marca qué días son de ESTA
                                  requisición, con el hotel y su fecha de cierre
                                  en el tooltip (Hugo, 2026-10-08 — mismo patrón
                                  que el badge de requisición del Timesheet del
                                  staff, sin tocar ese componente). */}
                              {runLength !== undefined && (
                                <TooltipProvider>
                                  <Tooltip open={isRunLit} onOpenChange={() => {}}>
                                    <TooltipTrigger asChild>
                                      <span
                                        className="pointer-events-none absolute -inset-y-1.5 -left-1 z-10"
                                        style={{ width: runLength * columnWidth - 8 }}
                                      >
                                        {isRunLit ? (
                                          <MovingBorderBox
                                            as="div"
                                            duration={3000}
                                            borderRadius="0.75rem"
                                            containerClassName="pointer-events-none h-full w-full p-[1.5px] text-base"
                                            borderClassName="h-[3px] w-16 rounded-full bg-[linear-gradient(90deg,transparent,#FF8000,transparent)] opacity-90"
                                            className="h-full w-full items-stretch justify-start border border-o-500/40 bg-transparent backdrop-blur-none"
                                          >
                                            <span />
                                          </MovingBorderBox>
                                        ) : (
                                          <span className="block h-full w-full rounded-xl border-2 border-dashed border-o-500/70" />
                                        )}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="text-xs font-semibold">{row.hotelName}</p>
                                      <p className="text-xs text-ink-3">
                                        {row.requisitionFolio || t`Sin folio`}
                                      </p>
                                      <p className="text-xs text-ink-4">
                                        <Trans>
                                          Cierra el {formatDayMonth(closingDateOf(mondayOf(day)))}
                                        </Trans>
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              <div className="relative">
                                <TimesheetDayCell
                                  entry={entry}
                                  isSelected={false}
                                  selectable={false}
                                  onToggle={() => {}}
                                  onReview={() => {}}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
