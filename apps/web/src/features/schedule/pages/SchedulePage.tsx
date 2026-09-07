import { cn } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import { useGetScheduleWeekQuery } from '../api/scheduleApi'
import { ScheduleMiniCalendar } from '../components/ScheduleMiniCalendar'
import {
  PersonAvatar,
  ScheduleWeekGrid,
  type ScheduleShiftSelection,
} from '../components/ScheduleWeekGrid'
import { ANY_VALUE } from '../types/schedule.types'

/** Piezas genéricas de navegación semanal, expuestas por el índice de Timesheet (§4). */
import { WeekNavigator, WeekSlider, addDaysIso, weekContaining } from '@/features/timesheet'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDayNumber, formatWeekRange, formatWeekday } from '@/shared/lib/formatters'

/** El ancho de una semana completa en el carrusel: la rejilla no tiene zoom. */
const WEEK_STEP_WIDTH = 7 * 96

/** Cómo se pinta la cobertura de una posición. */
function coverageTone(filled: number, quantity: number): string {
  if (filled >= quantity) return 'bg-green/15 text-ink-2'
  if (filled === 0) return 'bg-red/10 text-red'
  return 'bg-yellow/15 text-ink-2'
}

function coverageLabel(filled: number, quantity: number): string {
  if (filled >= quantity) return 'cubierto'
  if (filled === 0) return 'sin cubrir'
  const missing = quantity - filled
  return missing === 1 ? '1 hueco' : `${String(missing)} huecos`
}

/**
 * Schedule del hotel (maqueta del Manager de Área): calendario semanal por
 * hora — igual arquitectura que la vista Horas del Timesheet (grid + panel
 * lateral + mini-calendario) — donde converge la demanda (requisición) con la
 * cobertura (asignaciones). La cobertura es POR POSICIÓN — el contrato aún no
 * liga la entrada del schedule con la posición, así que el bloque del turno no
 * se tiñe por cobertura (sería inventar ese vínculo); el resumen de cobertura
 * arriba y en el panel SÍ usa datos reales.
 */
export function SchedulePage(): ReactNode {
  const [weekStart, setWeekStart] = useState<string>(ANY_VALUE)
  const [selection, setSelection] = useState<ScheduleShiftSelection | null>(null)

  const { data: week, isLoading, isError, refetch } = useGetScheduleWeekQuery({ weekStart })

  function selectWeek(target: string): void {
    setWeekStart(target)
    setSelection(null)
  }

  function pickDay(date: string): void {
    if (!week) return
    const target = weekContaining(week.availableWeeks, date)
    if (target) selectWeek(target)
  }

  const coverage =
    week && week.totalSlots > 0 ? Math.round((week.filledSlots / week.totalSlots) * 100) : 0
  const holes = week ? week.totalSlots - week.filledSlots : 0
  /** El mes que enseña el mini-calendario: el del jueves de la semana (ISO 8601). */
  const calendarMonth = week?.weekStart ? addDaysIso(week.weekStart, 3).slice(0, 7) : ''

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          <FoldText text="Schedule del hotel" />
        </h1>
        <p className="mt-1.5 text-sm text-ink-3">
          {week && week.weekStart !== ''
            ? `${week.hotelName} · Semana ${formatWeekRange(week.weekStart, addDaysIso(week.weekStart, 6))}`
            : 'Demanda y cobertura de la semana'}
          {IS_DEV_UI && <code className="text-ink-4"> · operations.schedule</code>}
        </p>
      </header>

      {isError && (
        <LoadError
          message="No se pudo cargar el Schedule. Revisa tu conexión e inténtalo de nuevo."
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading && !week ? (
        <TableSkeleton rows={5} columns={8} />
      ) : (
        week &&
        (week.weekStart === '' ? (
          <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
            Este hotel todavía no tiene Schedule. En cuanto se programe una semana, aparece aquí.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <WeekNavigator
                weekStart={week.weekStart}
                availableWeeks={week.availableWeeks}
                onSelect={selectWeek}
              />
              <p className="rounded-md bg-surface-2 px-3 py-2 text-sm text-ink-2">
                Semana: <span className="font-semibold">{coverage}% cubierto</span> ·{' '}
                {holes === 1 ? '1 hueco' : `${String(holes)} huecos`} — se asignan desde la Bolsa de
                la Reclutadora
              </p>
            </div>

            <WeekSlider
              weekStart={week.weekStart}
              availableWeeks={week.availableWeeks}
              stepWidth={WEEK_STEP_WIDTH}
              continuous={false}
              /* La rejilla scrollea horizontal por sí misma (como Días del
                 Timesheet): el dedo scrollea y la navegación táctil queda en ‹ ›. */
              allowTouchDrag={false}
              onNavigate={selectWeek}
            >
              <div className="flex flex-col gap-4 lg:flex-row">
                <ScheduleWeekGrid
                  week={week}
                  selectedWeek={week.weekStart}
                  selectedKey={selection?.key ?? null}
                  onSelectBlock={setSelection}
                />

                <aside className="flex shrink-0 flex-col gap-4 lg:w-80">
                  {selection === null ? (
                    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-line bg-surface p-5">
                      <p className="text-sm text-ink-3">
                        Elige un turno para ver a sus colaboradores.
                      </p>
                      <div className="flex flex-col gap-2 border-t border-line pt-3">
                        <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
                          Demanda de la semana
                          {IS_DEV_UI && (
                            <span className="font-normal text-ink-4"> · demand.position</span>
                          )}
                        </p>
                        {week.demand.length === 0 ? (
                          <p className="text-sm text-ink-3">
                            No hay requisiciones autorizadas para esta semana. Cuando un Manager
                            autorice una, sus posiciones aparecerán aquí.
                          </p>
                        ) : (
                          <ul className="flex flex-col gap-2">
                            {week.demand.map((row) => (
                              <li
                                key={row.positionId}
                                className="flex items-center justify-between gap-2"
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium text-ink">
                                    {row.name}
                                  </span>
                                  <span className="block truncate text-xs text-ink-3">
                                    {row.startTime} · demanda {row.quantity}
                                  </span>
                                  <span className="block truncate text-xs text-ink-4">
                                    {row.requisitionNumber}
                                  </span>
                                </span>
                                <span
                                  className={cn(
                                    'shrink-0 rounded-md px-2 py-1.5 text-center text-xs font-medium',
                                    coverageTone(row.filled, row.quantity),
                                  )}
                                >
                                  <span className="block text-sm font-semibold">
                                    {row.filled}/{row.quantity}
                                  </span>
                                  {coverageLabel(row.filled, row.quantity)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
                      <div>
                        <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
                          Turno elegido
                        </p>
                        <p className="mt-1 text-lg font-bold text-ink">
                          {formatWeekday(selection.day)} {formatDayNumber(selection.day)} ·{' '}
                          {selection.start} – {selection.end}
                        </p>
                        <p className="text-sm text-ink-3">
                          {selection.people.length === 1
                            ? '1 colaborador'
                            : `${String(selection.people.length)} colaboradores`}
                        </p>
                      </div>

                      <ul className="flex flex-col gap-3">
                        {selection.people.map((person) => (
                          <li key={person.id} className="flex items-center gap-3">
                            <PersonAvatar
                              name={person.workerName}
                              className="size-8 shrink-0 text-[10px]"
                            />
                            <span className="text-sm font-semibold text-ink">
                              {person.workerName}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <p className="border-t border-line pt-3 text-xs text-ink-3">
                        La posición y la requisición del turno se enseñan en la fila de Demanda: el
                        contrato aún no liga el turno con una posición.
                      </p>
                    </div>
                  )}

                  <ScheduleMiniCalendar
                    month={calendarMonth}
                    availableWeeks={week.availableWeeks}
                    selectedDay={selection?.day ?? null}
                    onPickDay={pickDay}
                  />
                </aside>
              </div>
            </WeekSlider>
          </>
        ))
      )}
    </div>
  )
}
