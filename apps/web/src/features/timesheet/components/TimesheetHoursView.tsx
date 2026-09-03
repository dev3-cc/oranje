import { cn, MaterialIcon, statusLight } from '@oranje/ui'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  GRID_HEIGHT,
  HOUR_PX,
  HOURS_END,
  HOURS_START,
  blockRect,
  minutesOf,
  nowOffset,
} from '../lib/hoursGeometry'
import { todayIso } from '../lib/weekNavigation'
import type { TimesheetEntry, TimesheetWeek } from '../types/timesheet.types'

import { Button } from '@/shared/components/Button'
import { TIMESHEET_STATUS_LABEL, TIMESHEET_STATUS_TOKEN } from '@/shared/constants/timesheetStatus'
import { formatDayNumber, formatWeekday } from '@/shared/lib/formatters'

/** Un bloque: las jornadas del día que comparten horario, agrupadas. */
interface HourBlock {
  key: string
  day: string
  start: string
  end: string
  /** La requisición del grupo: dos turnos iguales de requisiciones distintas son dos bloques. */
  requisition: string | null
  top: number
  height: number
  people: Array<{ entry: TimesheetEntry; workerName: string }>
}

/** `Ana Rivera Gómez` → `AR`. */
function initialsOf(name: string): string {
  const parts = name.split(' ').filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
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
 * La vista Horas: las mismas jornadas de la semana, dibujadas sobre una
 * rejilla de 06:00 a 22:00. Un bloque agrupa a quienes comparten horario ese
 * día — nunca un bloque por persona: quince jornadas idénticas encimadas no se
 * pueden leer. El detalle del bloque vive en el panel lateral.
 */
export function TimesheetHoursView({
  week,
  onReview,
}: {
  week: TimesheetWeek
  onReview: (entry: TimesheetEntry, workerName: string) => void
}): ReactNode {
  const today = todayIso()
  const nowMinutes = useNowMinutes()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  /** El día abierto en la agenda móvil; sin elección: hoy, o el primero con turnos. */
  const [agendaDay, setAgendaDay] = useState<string | null>(null)

  const blocksByDay = useMemo(() => {
    const groups = new Map<string, HourBlock>()
    for (const row of week.rows) {
      for (const entry of row.entries) {
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
        block.people.push({ entry, workerName: row.workerName })
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
  }, [week])

  const selected =
    selectedKey === null
      ? null
      : ([...blocksByDay.values()].flat().find((block) => block.key === selectedKey) ?? null)

  const hasBlocks = blocksByDay.size > 0
  const nowTop = week.days.includes(today) ? nowOffset(nowMinutes) : null
  const hours = Array.from(
    { length: HOURS_END - HOURS_START },
    (_item, index) => HOURS_START + index,
  )
  const activeDay =
    agendaDay ??
    (week.days.includes(today) ? today : ([...blocksByDay.keys()].sort()[0] ?? week.days[0] ?? ''))
  const agendaBlocks = [...(blocksByDay.get(activeDay) ?? [])].sort((first, second) =>
    first.start < second.start ? -1 : 1,
  )

  if (!hasBlocks) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
        Esta semana no hay jornadas con horas para dibujar. La vista Días también enseña ausencias y
        pendientes.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* ——— AGENDA DE UN DÍA (móvil): tira de días + tarjetas por hora ——— */}
      <div className="flex flex-col gap-3 lg:hidden">
        <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
          {week.days.map((day) => {
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
                {agendaBlocks.map((block) => {
                  const progress = shiftProgress(block, today, nowMinutes)
                  const pending = block.people.filter((p) => p.entry.status === 'PENDING').length
                  const observed = block.people.filter((p) => p.entry.status === 'OBSERVED').length
                  const reviewed = block.people.filter((p) => p.entry.status === 'REVIEWED').length
                  return (
                    <button
                      key={block.key}
                      type="button"
                      onClick={() => {
                        setSelectedKey(block.key === selectedKey ? null : block.key)
                      }}
                      className={cn(
                        'absolute right-2 left-2 flex cursor-pointer flex-col items-stretch justify-start overflow-hidden rounded-xl border bg-surface p-3 text-left shadow-sm transition-shadow hover:shadow-md',
                        'border-l-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
                        block.key === selectedKey
                          ? 'border-o-500 bg-o-500/10 ring-1 ring-o-500'
                          : 'border-line border-l-o-500',
                      )}
                      style={{ top: block.top + 2, height: block.height - 4 }}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-ink">
                          {block.start} – {block.end}
                        </span>
                        <span className="flex items-center">
                          {block.people.slice(0, 3).map((person, personIndex) => (
                            <span
                              key={person.entry.id}
                              className={cn(
                                'flex size-6 items-center justify-center rounded-full bg-o-500 text-[9px] font-bold text-ink ring-2 ring-surface',
                                personIndex > 0 && '-ml-1.5',
                              )}
                            >
                              {initialsOf(person.workerName)}
                            </span>
                          ))}
                          {block.people.length > 3 && (
                            <span className="ml-1 text-[10px] font-semibold text-ink-3">
                              +{String(block.people.length - 3)}
                            </span>
                          )}
                        </span>
                      </span>

                      {block.height >= 88 && (
                        <span className="mt-1 flex flex-wrap items-center gap-2">
                          {block.requisition !== null && (
                            <span className="text-[10px] font-semibold text-o-700">
                              {block.requisition}
                            </span>
                          )}
                          {pending > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-ink-2">
                              <span
                                className="size-1.5 rounded-full"
                                style={{ backgroundColor: statusLight['st-azul-claro'] }}
                                aria-hidden
                              />
                              {pending} pend.
                            </span>
                          )}
                          {observed > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-ink-2">
                              <span
                                className="size-1.5 rounded-full"
                                style={{ backgroundColor: statusLight['st-amarillo'] }}
                                aria-hidden
                              />
                              {observed} obs.
                            </span>
                          )}
                          {reviewed > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-ink-2">
                              <span
                                className="size-1.5 rounded-full"
                                style={{ backgroundColor: statusLight['st-morado'] }}
                                aria-hidden
                              />
                              {reviewed} rev.
                            </span>
                          )}
                        </span>
                      )}

                      {/* Cuánto va de la jornada: la barra al pie de la tarjeta. */}
                      <span
                        aria-hidden
                        className="absolute inset-x-0 bottom-0 block h-1.5 bg-ink/10"
                      >
                        <span
                          className="block h-full bg-o-500"
                          style={{ width: `${String((progress * 100).toFixed(0))}%` }}
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
              <div
                className="grid grid-cols-7"
                style={{ transform: 'translateX(var(--week-drag-x, 0px))' }}
              >
                {week.days.map((day) => (
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
              <div
                className="grid grid-cols-7"
                style={{ transform: 'translateX(var(--week-drag-x, 0px))' }}
              >
                {week.days.map((day) => (
                  <div
                    key={day}
                    className={cn('relative border-l border-line', dayTint(day, today))}
                    style={{
                      height: GRID_HEIGHT,
                      backgroundImage: `repeating-linear-gradient(to bottom, rgba(26, 17, 8, 0.06) 0 1px, transparent 1px ${String(HOUR_PX)}px)`,
                    }}
                  >
                    {(blocksByDay.get(day) ?? []).map((block) => (
                      <button
                        key={block.key}
                        type="button"
                        onClick={() => {
                          setSelectedKey(block.key === selectedKey ? null : block.key)
                        }}
                        title={`${block.start} – ${block.end} · ${String(block.people.length)} en el turno`}
                        className={cn(
                          'absolute right-1 left-1 flex cursor-pointer flex-col items-stretch justify-start overflow-hidden rounded-lg border bg-surface p-1.5 text-left shadow-sm transition-shadow hover:shadow-md',
                          'border-l-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
                          block.key === selectedKey
                            ? 'border-o-500 bg-o-500/10 ring-1 ring-o-500'
                            : 'border-line border-l-o-500',
                        )}
                        style={{ top: block.top + 1, height: block.height - 2 }}
                      >
                        <p className="truncate text-[11px] font-semibold text-ink">
                          {block.start} – {block.end}
                        </p>
                        <p className="truncate text-[10px] text-ink-3">
                          {block.people.length === 1
                            ? block.people[0]?.workerName
                            : `${String(block.people.length)} colaboradores`}
                        </p>
                        {block.requisition !== null && block.height >= 64 && (
                          <p className="truncate text-[9px] font-semibold text-o-700">
                            {block.requisition}
                          </p>
                        )}
                        {block.height >= 88 && (
                          <span className="absolute bottom-1.5 left-1.5 flex items-center">
                            {block.people.slice(0, 3).map((person, index) => (
                              <span
                                key={person.entry.id}
                                className={cn(
                                  'flex size-5 items-center justify-center rounded-full bg-o-500 text-[8px] font-bold text-ink ring-2 ring-surface',
                                  index > 0 && '-ml-1.5',
                                )}
                              >
                                {initialsOf(person.workerName)}
                              </span>
                            ))}
                            {block.people.length > 3 && (
                              <span className="ml-1 text-[9px] font-semibold text-ink-3">
                                +{String(block.people.length - 3)}
                              </span>
                            )}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>

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
              {selected.people.map(({ entry, workerName }) => {
                const color = statusLight[TIMESHEET_STATUS_TOKEN[entry.status]]
                return (
                  <li key={entry.id} className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-o-500 text-[10px] font-bold text-ink">
                      {initialsOf(workerName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {workerName}
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
                        onReview(entry, workerName)
                      }}
                    >
                      Revisar
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
