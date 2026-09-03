import { cn } from '@oranje/ui'
import { useReducedMotion } from 'framer-motion'
import { useContext, useState, type ReactNode } from 'react'

import { todayIso } from '../lib/weekNavigation'
import type {
  TimelineRow,
  TimesheetEntry,
  TimesheetRow,
  TimesheetTimeline,
} from '../types/timesheet.types'

import { TimesheetDayCell } from './TimesheetDayCell'
import { WeekDragContext } from './WeekSlider'
import { WorkerWeekSummary } from './WorkerWeekSummary'

import { Button as MovingBorderBox } from '@/shared/components/MovingBorder'
import { formatDayNumber, formatWeekday } from '@/shared/lib/formatters'
import { MOTION } from '@/shared/lib/motion'

/** Tinte de la celda: hoy naranja suave, fin de semana gris. Días identificables. */
function dayTint(day: string, today: string): string {
  if (day === today) return 'bg-o-500/5'
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
  return weekday === 0 || weekday === 6 ? 'bg-ink/5' : ''
}

/** La fila de resumen de la SEMANA elegida; `null` si esa semana no tiene timesheet. */
function summaryOf(
  row: TimelineRow,
  selectedWeek: string,
  weekDays: string[],
): TimesheetRow | null {
  const summary = row.byWeek[selectedWeek]
  if (!summary) return null
  return {
    timesheetId: summary.timesheetId,
    requisitionId: row.requisitionId,
    workerId: row.workerId,
    workerName: row.workerName,
    jobTitle: row.jobTitle,
    hotelName: row.hotelName,
    weekStatus: summary.weekStatus,
    totalHours: summary.totalHours,
    targetHours: null,
    entries: row.entries.filter((entry) => weekDays.includes(entry.date)),
  }
}

/** Corridas de días CONSECUTIVOS con registro: cada una es un tramo del carril. */
function runsOf(
  days: string[],
  byDate: Map<string, TimesheetEntry>,
): Array<{ start: number; length: number }> {
  const runs: Array<{ start: number; length: number }> = []
  let runStart = -1
  days.forEach((day, index) => {
    if (byDate.has(day)) {
      if (runStart === -1) runStart = index
    } else if (runStart !== -1) {
      runs.push({ start: runStart, length: index - runStart })
      runStart = -1
    }
  })
  if (runStart !== -1) runs.push({ start: runStart, length: days.length - runStart })
  return runs
}

/** La fila sin timesheet esta semana: presente, pero en voz baja. */
function QuietRow({ row }: { row: TimelineRow }): ReactNode {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-line px-3 py-3">
      {row.photoUrl ? (
        <img
          src={row.photoUrl}
          alt=""
          className="size-11 shrink-0 rounded-full object-cover opacity-70"
        />
      ) : (
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink-4 text-sm font-bold text-white"
          aria-hidden
        >
          {row.workerName.charAt(0)}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-base font-bold text-ink-3">{row.workerName}</p>
        <p className="text-xs text-ink-4">Sin timesheet esta semana</p>
      </div>
    </div>
  )
}

/**
 * La rejilla de la semana como CINTA continua: la columna del colaborador es
 * un marco fijo, y las fechas de TODAS las semanas cargadas viven en una sola
 * hoja que corre debajo — la ventana enseña 7 días y `--week-drag-x` (del
 * WeekSlider) la desliza en vivo hacia las vecinas. La transición se apaga
 * mientras el dedo manda y se enciende para asentarse.
 *
 * El resumen de la izquierda es de la SEMANA elegida (el timesheet es semana ×
 * persona × requisición); una persona sin timesheet esa semana conserva su
 * fila, con el resumen en silencio.
 */
export function TimesheetGrid({
  timeline,
  selectedWeek,
  columnWidth,
  selectedIds,
  onToggle,
  onReview,
  onManualPunch,
}: {
  timeline: TimesheetTimeline
  /** Lunes ISO de la semana en la ventana. */
  selectedWeek: string
  columnWidth: number
  selectedIds: Set<string>
  onToggle: (entryId: string) => void
  onReview: (entry: TimesheetEntry, workerName: string) => void
  onManualPunch: (row: TimesheetRow) => void
}): ReactNode {
  const { isDragging } = useContext(WeekDragContext)
  const reduceMotion = useReducedMotion() ?? false
  const today = todayIso()
  /** Fila cuyo badge de requisición está bajo el puntero: su tramo se enciende. */
  const [litRowKey, setLitRowKey] = useState<string | null>(null)

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
        Nadie coincide con esos filtros esta semana. Cambia la requisición, el estado o el hotel.
      </p>
    )
  }

  return (
    <>
      {/* ——— MÓVIL: tarjetas apiladas + tira de días con snap. La skill es
          clara: tabla ancha en pantalla chica → card layout, no rejilla. ——— */}
      <div className="flex flex-col gap-4 lg:hidden">
        {timeline.rows.map((row) => {
          const byDate = new Map(row.entries.map((item) => [item.date, item]))
          const summary = summaryOf(row, selectedWeek, weekDays)
          const daysWithEntry = weekDays.filter((day) => byDate.has(day))

          return (
            <section key={`${row.workerId}|${row.requisitionId}`} className="flex flex-col gap-2">
              {summary ? (
                <WorkerWeekSummary
                  row={summary}
                  photoUrl={row.photoUrl}
                  hotelPhotoUrl={row.hotelPhotoUrl}
                  onManualPunch={onManualPunch}
                />
              ) : (
                <QuietRow row={row} />
              )}
              {daysWithEntry.length === 0 ? (
                <p className="px-1 text-xs text-ink-3">Sin días registrados esta semana.</p>
              ) : (
                <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
                  {daysWithEntry.map((day) => {
                    const entry = byDate.get(day) as TimesheetEntry
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
                          isSelected={selectedIds.has(entry.id)}
                          onToggle={onToggle}
                          onReview={(item) => {
                            onReview(item, row.workerName)
                          }}
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
      {/* `w-fit`: la tarjeta termina donde terminan las columnas — sin lienzo
          blanco de sobra a la derecha; con zoom grande, scrollea por dentro. */}
      <div className="hidden w-fit max-w-full overflow-x-auto rounded-lg border border-line bg-surface lg:block">
        <div className="min-w-max">
          <div className="flex border-b border-line">
            {/* Columna FIJA de verdad: `sticky` la ancla también contra el scroll
              horizontal del contenedor (zoom/trackpad), no solo contra la
              cinta. En pantallas chicas se angosta: los días primero. */}
            <div className="sticky left-0 z-20 flex w-52 shrink-0 items-end border-r border-line bg-surface px-4 py-4 text-xs font-semibold tracking-wide text-ink-3 uppercase lg:w-[260px]">
              Colaborador
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
            const summary = summaryOf(row, selectedWeek, weekDays)
            /* Dónde ARRANCA cada corrida de la requisición y cuántos días cruza. */
            const runStartsByIndex = new Map(
              runsOf(timeline.days, byDate).map((run) => [run.start, run.length]),
            )
            const rowKey = `${row.workerId}|${row.requisitionId}`
            const isLit = litRowKey === rowKey && !reduceMotion

            return (
              <div
                key={`${row.workerId}|${row.requisitionId}`}
                className="flex border-b border-line last:border-b-0"
              >
                <div className="sticky left-0 z-20 w-52 shrink-0 border-r border-line bg-surface px-2 py-3 lg:w-[260px] lg:px-3">
                  {summary ? (
                    <WorkerWeekSummary
                      row={summary}
                      photoUrl={row.photoUrl}
                      hotelPhotoUrl={row.hotelPhotoUrl}
                      onManualPunch={onManualPunch}
                      onRequisitionHover={(hovering) => {
                        setLitRowKey(hovering ? rowKey : null)
                      }}
                    />
                  ) : (
                    <QuietRow row={row} />
                  )}
                </div>

                <div className="overflow-hidden" style={{ width: viewportWidth }}>
                  <div className="relative grid h-full items-start" style={sheetStyle}>
                    {timeline.days.map((day, dayIndex) => {
                      const entry = byDate.get(day)
                      /* El marco del carril nace en la PRIMERA celda de cada
                         corrida y hereda la ALTURA de la tarjeta (por eso no
                         se descuadra con el zoom); su ancho cruza las celdas
                         siguientes del tramo. */
                      const runLength = runStartsByIndex.get(dayIndex)

                      return (
                        <div
                          key={day}
                          className={cn(
                            'relative self-stretch border-l border-line px-2 py-4',
                            dayTint(day, today),
                          )}
                        >
                          {/* Un día sin registro se deja VACÍO, no con una tarjeta en
                            cero: nadie fichó, y dibujar algo sugiere lo contrario. */}
                          {entry && (
                            <div className="relative">
                              {/* En reposo, contorno quieto (la fila ya agrupa);
                                  el borde vivo SOLO responde al hover del badge
                                  de la requisición: motion con propósito. */}
                              {runLength !== undefined && (
                                <span
                                  aria-hidden
                                  className="pointer-events-none absolute -inset-y-1.5 -left-1 z-0"
                                  style={{ width: runLength * columnWidth - 8 }}
                                >
                                  {isLit ? (
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
                                    <span className="block h-full w-full rounded-xl border border-o-500/25" />
                                  )}
                                </span>
                              )}
                              <div className="relative">
                                <TimesheetDayCell
                                  entry={entry}
                                  isSelected={selectedIds.has(entry.id)}
                                  onToggle={onToggle}
                                  onReview={(item) => {
                                    onReview(item, row.workerName)
                                  }}
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
