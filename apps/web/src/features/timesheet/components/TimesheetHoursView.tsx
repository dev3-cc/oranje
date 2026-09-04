import { cn, MaterialIcon, statusLight } from '@oranje/ui'
import { useReducedMotion } from 'framer-motion'
import { useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'

import {
  GRID_HEIGHT,
  HOUR_PX,
  HOURS_END,
  HOURS_START,
  blockRect,
  minutesOf,
  nowOffset,
} from '../lib/hoursGeometry'
import { addDaysIso, todayIso } from '../lib/weekNavigation'
import type {
  ReviewContext,
  TimelineRow,
  TimesheetEntry,
  TimesheetRow,
  TimesheetTimeline,
} from '../types/timesheet.types'

import { WeekDragContext } from './WeekSlider'

import { Button } from '@/shared/components/Button'
import { TIMESHEET_STATUS_LABEL, TIMESHEET_STATUS_TOKEN } from '@/shared/constants/timesheetStatus'
import { formatDayNumber, formatWeekday } from '@/shared/lib/formatters'
import { MOTION } from '@/shared/lib/motion'

/** Un bloque: las jornadas del día que comparten horario y requisición. */
interface HourBlock {
  key: string
  day: string
  start: string
  end: string
  /** La requisición del grupo (folio); se enseña en el panel, no en el bloque. */
  requisition: string | null
  top: number
  height: number
  people: Array<{ entry: TimesheetEntry; row: TimelineRow }>
}

/** El estado que manda en el grupo: el que pide atención primero. */
const STATUS_PRIORITY = ['OBSERVED', 'PENDING', 'REVIEWED'] as const
function dominantStatus(block: HourBlock): (typeof STATUS_PRIORITY)[number] {
  for (const status of STATUS_PRIORITY) {
    if (block.people.some((person) => person.entry.status === status)) return status
  }
  return 'REVIEWED'
}

/** `Ana Rivera Gómez` → `AR`. */
function initialsOf(name: string): string {
  const parts = name.split(' ').filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
}

/** La cara de la persona: su foto, o sus iniciales sobre naranja (D-30). */
function PersonAvatar({ row, className }: { row: TimelineRow; className: string }): ReactNode {
  if (row.photoUrl) {
    return (
      <img
        src={row.photoUrl}
        alt=""
        className={cn('rounded-full object-cover', className)}
        onError={(event) => {
          event.currentTarget.style.display = 'none'
        }}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        'flex items-center justify-center rounded-full bg-o-500 font-bold text-ink',
        className,
      )}
    >
      {initialsOf(row.workerName)}
    </span>
  )
}

/** El contexto que viaja a la Revisión del día: el hero del modal. */
function contextOf(row: TimelineRow): ReviewContext {
  return {
    workerPhotoUrl: row.photoUrl,
    jobTitle: row.jobTitle,
    hotelName: row.hotelName,
    hotelPhotoUrl: row.hotelPhotoUrl,
  }
}

/**
 * Empaquetado por carriles: bloques que se solapan en el tiempo se reparten
 * el ancho de la columna en vez de taparse (dos requisiciones con el mismo
 * horario son dos bloques lado a lado).
 */
function withLanes(
  blocks: HourBlock[],
): Array<{ block: HourBlock; lane: number; laneCount: number }> {
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

/** `2026-09-03` → `Jueves 3 de septiembre`, para el encabezado de la agenda. */
function agendaDayLabel(iso: string): string {
  const label = new Date(`${iso}T00:00:00Z`).toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * Cuánto va de la jornada, 0–1: un día pasado está completo, uno futuro no ha
 * empezado, y hoy avanza con el reloj. Es la barra al pie de cada tarjeta.
 */
function shiftProgress(block: HourBlock, today: string, nowMinutes: number): number {
  if (block.day < today) return 1
  if (block.day > today) return 0
  const start = minutesOf(block.start)
  const end = minutesOf(block.end)
  if (start === null || end === null || end <= start) return 0
  return Math.min(Math.max((nowMinutes - start) / (end - start), 0), 1)
}

/** Minutos del reloj local, refrescados por minuto para la línea de «ahora». */
function useNowMinutes(): number {
  const [minutes, setMinutes] = useState(() => new Date().getHours() * 60 + new Date().getMinutes())
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      setMinutes(now.getHours() * 60 + now.getMinutes())
    }, 60_000)
    return () => {
      clearInterval(timer)
    }
  }, [])
  return minutes
}

/**
 * La vista Horas: las jornadas de la semana elegida sobre una rejilla de
 * 06:00 a 22:00, bebiendo de la CINTA (por eso trae fotos y hotel). Un bloque
 * agrupa a quienes comparten horario y requisición — nunca un bloque por
 * persona — y se pinta con el tinte del estado que más atención pide, con su
 * banda de color abajo. El detalle vive en el panel lateral.
 */
export function TimesheetHoursView({
  timeline,
  selectedWeek,
  onReview,
}: {
  timeline: TimesheetTimeline
  /** Lunes ISO de la semana a dibujar. */
  selectedWeek: string
  onReview: (
    entry: TimesheetEntry,
    workerName: string,
    context: ReviewContext | undefined,
    manualPunchTarget: Pick<TimesheetRow, 'requisitionId' | 'workerId' | 'workerName'>,
  ) => void
}): ReactNode {
  const today = todayIso()
  const nowMinutes = useNowMinutes()
  const { isDragging } = useContext(WeekDragContext)
  const reduceMotion = useReducedMotion() ?? false
  /**
   * El transform que traduce la zona de fechas (WeekSlider lo publica en
   * `--week-drag-x`). Mientras el dedo manda, sin transición — la variable
   * cambia a cada `pointermove`, y una transición ahí se sentiría con
   * retraso. Al soltar (`isDragging` ya en `false`), la misma variable puede
   * caer de golpe a 0 (WeekSlider la resetea al confirmar la navegación): con
   * la transición encendida, ese reset se ANIMA en vez de saltar — mismo
   * patrón que ya usa `TimesheetGrid` (la cinta continua de Días).
   */
  const dateTransform: CSSProperties = {
    transform: 'translateX(var(--week-drag-x, 0px))',
    transition:
      isDragging || reduceMotion
        ? 'none'
        : `transform ${String(MOTION.enter * 1000)}ms cubic-bezier(0, 0, 0.2, 1)`,
  }
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  /** El día abierto en la agenda móvil; sin elección: hoy, o el primero con turnos. */
  const [agendaDay, setAgendaDay] = useState<string | null>(null)

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_item, index) => addDaysIso(selectedWeek, index)),
    [selectedWeek],
  )

  const blocksByDay = useMemo(() => {
    const inWeek = new Set(weekDays)
    const groups = new Map<string, HourBlock>()
    for (const row of timeline.rows) {
      for (const entry of row.entries) {
        if (!inWeek.has(entry.date)) continue
        if (entry.isAbsence || entry.startTime === null || entry.endTime === null) continue
        const rect = blockRect(entry.startTime, entry.endTime)
        if (!rect) continue
        const key = `${entry.date}|${entry.startTime}|${entry.endTime}|${entry.requisitionNumber ?? ''}`
        const block = groups.get(key) ?? {
          key,
          day: entry.date,
          start: entry.startTime,
          end: entry.endTime,
          requisition: entry.requisitionNumber,
          top: rect.top,
          height: rect.height,
          people: [],
        }
        block.people.push({ entry, row })
        groups.set(key, block)
      }
    }
    const byDay = new Map<string, HourBlock[]>()
    for (const block of groups.values()) {
      const list = byDay.get(block.day) ?? []
      list.push(block)
      byDay.set(block.day, list)
    }
    return byDay
  }, [timeline, weekDays])

  const selected =
    selectedKey === null
      ? null
      : ([...blocksByDay.values()].flat().find((block) => block.key === selectedKey) ?? null)

  const hasBlocks = blocksByDay.size > 0
  const nowTop = weekDays.includes(today) ? nowOffset(nowMinutes) : null
  const hours = Array.from(
    { length: HOURS_END - HOURS_START },
    (_item, index) => HOURS_START + index,
  )
  const activeDay =
    agendaDay ??
    (weekDays.includes(today) ? today : ([...blocksByDay.keys()].sort()[0] ?? weekDays[0] ?? ''))
  const agendaBlocks = [...(blocksByDay.get(activeDay) ?? [])].sort((first, second) =>
    first.start < second.start ? -1 : 1,
  )

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* ——— AGENDA DE UN DÍA (móvil): tira de días + tarjetas por hora ——— */}
      <div className="flex flex-col gap-3 lg:hidden">
        <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
          {weekDays.map((day) => {
            const hasShift = blocksByDay.has(day)
            const isActive = day === activeDay
            return (
              <button
                key={day}
                type="button"
                onClick={() => {
                  setAgendaDay(day)
                  setSelectedKey(null)
                }}
                aria-pressed={isActive}
                className={cn(
                  'flex min-h-11 min-w-12 shrink-0 cursor-pointer snap-start flex-col items-center gap-0.5 rounded-xl border px-2 py-1.5 transition-colors',
                  isActive
                    ? 'border-o-500 bg-o-500 text-ink'
                    : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
                )}
              >
                <span className="text-[10px] font-medium uppercase">{formatWeekday(day)}</span>
                <span className="text-base font-bold">{formatDayNumber(day)}</span>
                {/* El punto dice «este día tiene turnos» sin abrirlo. */}
                <span
                  aria-hidden
                  className={cn(
                    'size-1.5 rounded-full',
                    hasShift ? (isActive ? 'bg-ink' : 'bg-o-500') : 'bg-transparent',
                  )}
                />
              </button>
            )
          })}
        </div>

        <div className="flex items-baseline justify-between px-1">
          <p className="text-sm font-bold text-ink">{agendaDayLabel(activeDay)}</p>
          {activeDay === today && (
            <p className="text-xs font-semibold text-ink-3">
              {String(Math.floor(nowMinutes / 60)).padStart(2, '0')}:
              {String(nowMinutes % 60).padStart(2, '0')}
            </p>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          {agendaBlocks.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink-3">
              Este día no tiene jornadas con horas. El punto naranja marca los días que sí.
            </p>
          ) : (
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

              <div
                className="relative flex-1 border-l border-line"
                style={{
                  height: GRID_HEIGHT,
                  backgroundImage: `repeating-linear-gradient(to bottom, rgba(26, 17, 8, 0.06) 0 1px, transparent 1px ${String(HOUR_PX)}px)`,
                }}
              >
                {withLanes(agendaBlocks).map(({ block, lane, laneCount }) => {
                  const progress = shiftProgress(block, today, nowMinutes)
                  const blockColor = statusLight[TIMESHEET_STATUS_TOKEN[dominantStatus(block)]]
                  const single = block.people.length === 1 ? block.people[0] : null
                  const laneWidth = 100 / laneCount
                  return (
                    <button
                      key={block.key}
                      type="button"
                      onClick={() => {
                        setSelectedKey(block.key === selectedKey ? null : block.key)
                      }}
                      className={cn(
                        'absolute flex cursor-pointer flex-col items-stretch justify-start overflow-hidden rounded-xl bg-surface p-3 text-left shadow-sm transition-shadow hover:shadow-md',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
                        block.key === selectedKey && 'ring-2 ring-o-500',
                      )}
                      style={{
                        top: block.top + 2,
                        height: block.height - 4,
                        left: `calc(${String(lane * laneWidth)}% + 8px)`,
                        width: `calc(${String(laneWidth)}% - 12px)`,
                        backgroundImage: `linear-gradient(${blockColor}33, ${blockColor}33)`,
                      }}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-ink">
                            {block.start} – {block.end}
                          </span>
                          <span className="block truncate text-xs text-ink-2">
                            {single
                              ? single.row.workerName
                              : `${String(block.people.length)} colaboradores`}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center">
                          {block.people.slice(0, 3).map((person, personIndex) => (
                            <PersonAvatar
                              key={person.entry.id}
                              row={person.row}
                              className={cn(
                                'size-7 text-[9px] ring-2 ring-surface',
                                personIndex > 0 && '-ml-2',
                              )}
                            />
                          ))}
                          {block.people.length > 3 && (
                            <span className="ml-1 rounded-full bg-surface px-1.5 text-[10px] font-bold text-ink">
                              +{String(block.people.length - 3)}
                            </span>
                          )}
                        </span>
                      </span>

                      {/* Cuánto va de la jornada, sobre la pista del estado. */}
                      <span aria-hidden className="absolute inset-x-0 bottom-0 block h-1.5">
                        <span
                          className="absolute inset-0"
                          style={{ backgroundColor: `${blockColor}55` }}
                        />
                        <span
                          className="absolute inset-y-0 left-0"
                          style={{
                            backgroundColor: blockColor,
                            width: `${String((progress * 100).toFixed(0))}%`,
                          }}
                        />
                      </span>
                    </button>
                  )
                })}

                {activeDay === today && nowTop !== null && (
                  <div
                    className="pointer-events-none absolute right-0 left-0 z-10"
                    style={{ top: nowTop }}
                  >
                    <span className="absolute -top-[3px] left-0 size-2 rounded-full bg-red" />
                    <div className="h-0.5 bg-red" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ——— REJILLA SEMANAL (escritorio) ——— */}
      {/* En pantallas chicas la rejilla scrollea DENTRO de su tarjeta (nunca la página). */}
      <div className="hidden min-w-0 flex-1 overflow-x-auto rounded-lg border border-line bg-surface lg:block">
        <div className="min-w-[640px]">
          {/* Cabecera de días: el hueco del riel es fijo; las fechas son la
              hoja que corre con `--week-drag-x` (la publica el WeekSlider). */}
          <div className="flex border-b border-line">
            <div className="w-12 shrink-0" />
            <div className="flex-1 overflow-hidden">
              <div className="grid grid-cols-7" style={dateTransform}>
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className={cn(
                      'border-l border-line px-2 py-3 text-center',
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

          {/* Rejilla de horas: el riel de horas es fijo; los días se deslizan. */}
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

            <div className="relative flex-1 overflow-hidden">
              <div className="grid grid-cols-7" style={dateTransform}>
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className={cn('relative border-l border-line', dayTint(day, today))}
                    style={{
                      height: GRID_HEIGHT,
                      backgroundImage: `repeating-linear-gradient(to bottom, rgba(26, 17, 8, 0.06) 0 1px, transparent 1px ${String(HOUR_PX)}px)`,
                    }}
                  >
                    {withLanes(blocksByDay.get(day) ?? []).map(({ block, lane, laneCount }) => {
                      const blockColor = statusLight[TIMESHEET_STATUS_TOKEN[dominantStatus(block)]]
                      const single = block.people.length === 1 ? block.people[0] : null
                      const laneWidth = 100 / laneCount
                      return (
                        <button
                          key={block.key}
                          type="button"
                          onClick={() => {
                            setSelectedKey(block.key === selectedKey ? null : block.key)
                          }}
                          title={`${block.start} – ${block.end} · ${String(block.people.length)} en el turno`}
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
                            backgroundImage: `linear-gradient(${blockColor}33, ${blockColor}33)`,
                          }}
                        >
                          {/* La persona al frente: cara, nombre y su horario. */}
                          {block.height >= 72 && (
                            <span className="mb-1 flex items-center justify-between gap-1">
                              <span className="flex items-center">
                                {block.people.slice(0, 3).map((person, personIndex) => (
                                  <PersonAvatar
                                    key={person.entry.id}
                                    row={person.row}
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
                            {single
                              ? single.row.workerName
                              : `${String(block.people.length)} colaboradores`}
                          </span>

                          {/* La banda del estado, abajo — color + leyenda arriba. */}
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

              {/* Semana sin jornadas: el calendario SE QUEDA (no se evapora al
                  deslizar); el aviso flota encima y nada más. */}
              {!hasBlocks && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center pt-16">
                  <p className="rounded-full border border-dashed border-line bg-surface/95 px-4 py-2 text-sm text-ink-3 shadow-sm">
                    Esta semana no hay jornadas con horas. La vista Días también enseña ausencias y
                    pendientes.
                  </p>
                </div>
              )}

              {/* La hora actual, solo si hoy está a la vista y dentro del lienzo.
                Vive en el visor (no en la hoja): marca el tiempo, no una fecha,
                así que no se desliza con el arrastre. */}
              {nowTop !== null && (
                <div
                  className="pointer-events-none absolute right-0 left-0 z-10"
                  style={{ top: nowTop }}
                >
                  <div className="h-0.5 bg-red" />
                  <p className="absolute -top-2 left-1 rounded bg-red px-1 py-0.5 text-[9px] font-bold text-white">
                    {String(Math.floor(nowMinutes / 60)).padStart(2, '0')}:
                    {String(nowMinutes % 60).padStart(2, '0')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Panel del bloque elegido */}
      <aside className="shrink-0 lg:w-80">
        {selected === null ? (
          <p className="rounded-lg border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-3">
            Elige un bloque para ver a sus colaboradores y revisar sus días.
          </p>
        ) : (
          <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
                Turno elegido
              </p>
              <p className="mt-1 text-lg font-bold text-ink">
                {formatWeekday(selected.day)} {formatDayNumber(selected.day)} · {selected.start} –{' '}
                {selected.end}
              </p>
              <p className="text-sm text-ink-3">
                {selected.people.length === 1
                  ? '1 colaborador'
                  : `${String(selected.people.length)} colaboradores`}
              </p>
              {selected.requisition !== null && (
                <span
                  title="Todos los días de este grupo pertenecen a esta requisición"
                  className="mt-2 inline-flex items-center gap-1 rounded-md bg-o-50 px-2.5 py-1 text-xs font-semibold text-o-700"
                >
                  <MaterialIcon name="assignment" className="text-sm" />
                  {selected.requisition}
                </span>
              )}
            </div>

            <ul className="flex flex-col gap-3">
              {selected.people.map(({ entry, row }) => {
                const color = statusLight[TIMESHEET_STATUS_TOKEN[entry.status]]
                return (
                  <li key={entry.id} className="flex items-center gap-3">
                    <PersonAvatar row={row} className="size-8 shrink-0 text-[10px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {row.workerName}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-ink-3">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: color }}
                          aria-hidden
                        />
                        {TIMESHEET_STATUS_LABEL[entry.status]}
                        {entry.punch === 'INCOMPLETE' && ' · sin salida'}
                      </span>
                    </span>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        onReview(entry, row.workerName, contextOf(row), {
                          requisitionId: row.requisitionId,
                          workerId: row.workerId,
                          workerName: row.workerName,
                        })
                      }}
                    >
                      {/* "Revisar" en un día ya Revisado prometía una acción que
                          no iba a pasar — el botón abre lo mismo, pero lo que
                          hay del otro lado ya no es una revisión pendiente. */}
                      {entry.status === 'REVIEWED' ? 'Ver revisión' : 'Revisar'}
                    </Button>
                  </li>
                )
              })}
            </ul>

            <p className="border-t border-line pt-3 text-xs text-ink-3">
              El Supervisor revisa; la aprobación de horas es del Manager de Área o del Manager
              General.
            </p>
          </div>
        )}
      </aside>
    </div>
  )
}
