import { Trans, useLingui } from '@lingui/react/macro'
import { brand, cn } from '@oranje/ui'
import { useContext, useMemo, type CSSProperties, type ReactNode } from 'react'

import type { ScheduleTimeline, ScheduleWorkerEntry } from '../types/schedule.types'

/** Piezas genéricas de navegación semanal, expuestas por el índice de Timesheet (§4). */
import { WeekDragContext, todayIso } from '@/features/timesheet'
import { formatDayNumber, formatWeekday } from '@/shared/lib/formatters'
import { GRID_HEIGHT, HOUR_PX, HOURS_END, HOURS_START, blockRect } from '@/shared/lib/hoursGeometry'
import { MOTION } from '@/shared/lib/motion'

/** Un bloque: los turnos del día que comparten horario exacto. */
interface ShiftBlock {
  key: string
  day: string
  start: string
  end: string
  top: number
  height: number
  people: ScheduleWorkerEntry[]
}

/** El bloque elegido, tal como lo necesita el panel lateral (sin geometría). */
export interface ScheduleShiftSelection {
  key: string
  day: string
  start: string
  end: string
  people: ScheduleWorkerEntry[]
}

/** `Ana Rivera Gómez` → `AR`. */
function initialsOf(name: string): string {
  const parts = name.split(' ').filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
}

/** La cara de la persona: sus iniciales sobre naranja (D-30: sin foto en el contrato del schedule). */
export function PersonAvatar({ name, className }: { name: string; className: string }): ReactNode {
  return (
    <span
      aria-hidden
      className={cn(
        'flex items-center justify-center rounded-full bg-o-500 font-bold text-ink',
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  )
}

/**
 * Empaquetado por carriles: turnos que se solapan en el tiempo se reparten
 * el ancho de la columna en vez de taparse (mismo patrón que la vista Horas
 * del Timesheet — `withLanes`).
 */
function packLanes(
  blocks: ShiftBlock[],
): Array<{ block: ShiftBlock; lane: number; laneCount: number }> {
  const sorted = [...blocks].sort((a, b) => a.top - b.top || b.height - a.height)
  const laneEnds: number[] = []
  const placed = sorted.map((block) => {
    let lane = laneEnds.findIndex((end) => end <= block.top)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(0)
    }
    laneEnds[lane] = block.top + block.height
    return { block, lane }
  })
  return placed.map((item) => ({ ...item, laneCount: laneEnds.length }))
}

/** Tinte de columna: hoy naranja suave, fin de semana gris; celdas legibles. */
function dayTint(day: string, today: string): string {
  if (day === today) return 'bg-o-500/5'
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
  return weekday === 0 || weekday === 6 ? 'bg-ink/5' : ''
}

/**
 * La rejilla del Schedule como CINTA continua: el riel de horas es un marco
 * fijo, y los días de TODAS las semanas cargadas viven en una sola hoja que
 * corre debajo — la ventana enseña 7 días y `--week-drag-x` (del WeekSlider,
 * en modo `continuous`) la desliza en vivo hacia las vecinas, igual que la
 * vista Días del Timesheet (`TimesheetGrid`). La transición se apaga mientras
 * el dedo manda y se enciende para asentarse.
 *
 * Cada bloque es un tono naranja consistente, no un color por persona ni por
 * cobertura — el contrato aún no liga `schedule_entry` con la posición de la
 * requisición, así que un tinte "por cobertura" en el bloque sería inventar
 * un vínculo que no existe (ver el resumen de cobertura, que sí es real).
 */
export function ScheduleTimelineGrid({
  timeline,
  selectedWeek,
  columnWidth,
  selectedKey,
  onSelectBlock,
}: {
  timeline: ScheduleTimeline
  /** Lunes ISO de la semana en la ventana. */
  selectedWeek: string
  columnWidth: number
  selectedKey: string | null
  onSelectBlock: (block: ScheduleShiftSelection | null) => void
}): ReactNode {
  const { t } = useLingui()
  const today = todayIso()
  const { isDragging } = useContext(WeekDragContext)

  const baseIndex = Math.max(timeline.days.indexOf(selectedWeek), 0)
  const weekDays = timeline.days.slice(baseIndex, baseIndex + 7)
  const viewportWidth = 7 * columnWidth
  const sheetStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${String(timeline.days.length)}, ${String(columnWidth)}px)`,
    transform: `translateX(calc(${String(-baseIndex * columnWidth)}px + var(--week-drag-x, 0px)))`,
    transition: isDragging
      ? 'none'
      : `transform ${String(MOTION.enter * 1000)}ms cubic-bezier(0, 0, 0.2, 1)`,
  }

  const blocksByDay = useMemo(() => {
    const groups = new Map<string, ShiftBlock>()
    for (const entry of timeline.entries) {
      const rect = blockRect(entry.startTime, entry.endTime)
      if (!rect) continue
      const key = `${entry.workDate}|${entry.startTime}|${entry.endTime}`
      const block = groups.get(key) ?? {
        key,
        day: entry.workDate,
        start: entry.startTime,
        end: entry.endTime,
        top: rect.top,
        height: rect.height,
        people: [],
      }
      block.people.push(entry)
      groups.set(key, block)
    }
    const byDay = new Map<string, ShiftBlock[]>()
    for (const block of groups.values()) {
      const list = byDay.get(block.day) ?? []
      list.push(block)
      byDay.set(block.day, list)
    }
    return byDay
  }, [timeline.entries])

  const hasVisibleBlocks = weekDays.some((day) => (blocksByDay.get(day)?.length ?? 0) > 0)
  const hours = Array.from(
    { length: HOURS_END - HOURS_START },
    (_item, index) => HOURS_START + index,
  )
  const blockColor = brand['o-500']

  return (
    <div className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-line bg-surface">
      <div className="min-w-max">
        {/* Cabecera de días: el hueco del riel es fijo; la CINTA de fechas de
            todas las semanas corre debajo, igual que TimesheetGrid. */}
        <div className="flex border-b border-line">
          <div className="w-12 shrink-0" />
          <div className="overflow-hidden" style={{ width: viewportWidth }}>
            <div className="grid" style={sheetStyle}>
              {timeline.days.map((day) => (
                <div
                  key={day}
                  className={cn('border-l border-line px-2 py-3 text-center', dayTint(day, today))}
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

        {/* Rejilla de horas: el riel de horas es fijo; la cinta de días corre. */}
        <div className="flex">
          <div className="relative w-12 shrink-0" style={{ height: GRID_HEIGHT }}>
            {hours.map((hour) => (
              <p
                key={hour}
                className="absolute right-2 text-[10px] text-ink-3"
                style={{
                  top: (hour - HOURS_START) * HOUR_PX + (hour === HOURS_START ? 4 : -6),
                }}
              >
                {String(hour).padStart(2, '0')}:00
              </p>
            ))}
          </div>

          <div className="relative overflow-hidden" style={{ width: viewportWidth }}>
            <div className="grid" style={sheetStyle}>
              {timeline.days.map((day) => (
                <div
                  key={day}
                  className={cn('relative border-l border-line', dayTint(day, today))}
                  style={{
                    height: GRID_HEIGHT,
                    backgroundImage: `repeating-linear-gradient(to bottom, rgba(26, 17, 8, 0.06) 0 1px, transparent 1px ${String(HOUR_PX)}px)`,
                  }}
                >
                  {packLanes(blocksByDay.get(day) ?? []).map(({ block, lane, laneCount }) => {
                    const single = block.people.length === 1 ? block.people[0] : null
                    const laneWidth = 100 / laneCount
                    return (
                      <button
                        key={block.key}
                        type="button"
                        onClick={() => {
                          onSelectBlock(
                            block.key === selectedKey
                              ? null
                              : {
                                  key: block.key,
                                  day: block.day,
                                  start: block.start,
                                  end: block.end,
                                  people: block.people,
                                },
                          )
                        }}
                        title={t`${block.start} – ${block.end} · ${block.people.length} en el turno`}
                        className={cn(
                          'absolute flex cursor-pointer flex-col items-stretch justify-start overflow-hidden rounded-xl bg-surface p-2 text-left shadow-sm transition-shadow hover:shadow-md',
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
                          block.key === selectedKey && 'ring-2 ring-o-500',
                        )}
                        style={{
                          top: block.top + 1,
                          height: block.height - 2,
                          left: `calc(${String(lane * laneWidth)}% + 4px)`,
                          width: `calc(${String(laneWidth)}% - 7px)`,
                          backgroundImage: `linear-gradient(${blockColor}26, ${blockColor}26)`,
                        }}
                      >
                        {block.height >= 72 && (
                          <span className="mb-1 flex items-center justify-between gap-1">
                            <span className="flex items-center">
                              {block.people.slice(0, 3).map((person, personIndex) => (
                                <PersonAvatar
                                  key={person.id}
                                  name={person.workerName}
                                  className={cn(
                                    'size-6 text-[8px] ring-2 ring-surface',
                                    personIndex > 0 && '-ml-2',
                                  )}
                                />
                              ))}
                            </span>
                            {block.people.length > 1 && (
                              <span className="rounded-full bg-surface px-1.5 text-[9px] font-bold text-ink">
                                {block.people.length}
                              </span>
                            )}
                          </span>
                        )}
                        <span className="block truncate text-[11px] font-bold text-ink">
                          {block.start} – {block.end}
                        </span>
                        <span className="block truncate text-[10px] text-ink-2">
                          {single ? single.workerName : t`${block.people.length} colaboradores`}
                        </span>

                        <span
                          aria-hidden
                          className="absolute inset-x-0 bottom-0 h-1.5"
                          style={{ backgroundColor: blockColor }}
                        />
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Semana sin programados: el calendario SE QUEDA (no se evapora
                al deslizar); el aviso flota encima y nada más. */}
            {!hasVisibleBlocks && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center pt-16">
                <p className="rounded-full border border-dashed border-line bg-surface/95 px-4 py-2 text-sm text-ink-3 shadow-sm">
                  <Trans>
                    Nadie programado todavía: los turnos aparecen conforme se cubren los slots.
                  </Trans>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
