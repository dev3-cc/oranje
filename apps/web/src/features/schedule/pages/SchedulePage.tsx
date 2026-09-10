import type { MessageDescriptor } from '@lingui/core'
import { msg, plural } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import { useGetScheduleTimelineQuery } from '../api/scheduleApi'
import { AddShiftDialog } from '../components/AddShiftDialog'
import { ScheduleMiniCalendar } from '../components/ScheduleMiniCalendar'
import {
  PersonAvatar,
  ScheduleTimelineGrid,
  type ScheduleShiftSelection,
} from '../components/ScheduleTimelineGrid'
import { ANY_VALUE } from '../types/schedule.types'

/** Piezas genéricas de navegación semanal, expuestas por el índice de Timesheet (§4). */
import {
  WeekNavigator,
  WeekSlider,
  addDaysIso,
  resolveWeek,
  weekContaining,
} from '@/features/timesheet'
import { Button } from '@/shared/components/Button'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { useCan } from '@/shared/hooks/useCan'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDayNumber, formatWeekRange, formatWeekday } from '@/shared/lib/formatters'

/** El ancho de un día en el carrusel: la unidad de la cinta continua. */
const COLUMN_WIDTH = 132

/** Cómo se pinta la cobertura de una posición. */
function coverageTone(filled: number, quantity: number): string {
  if (filled >= quantity) return 'bg-green/15 text-ink-2'
  if (filled === 0) return 'bg-red/10 text-red'
  return 'bg-yellow/15 text-ink-2'
}

/** Devuelve el descriptor: quien pinta lo traduce con `i18n._()` (D-36). */
function coverageLabel(filled: number, quantity: number): MessageDescriptor {
  if (filled >= quantity) return msg`cubierto`
  if (filled === 0) return msg`sin cubrir`
  const missing = quantity - filled
  return msg`${plural(missing, { one: '# hueco', other: '# huecos' })}`
}

/**
 * Schedule del hotel (maqueta del Manager de Área): calendario semanal por
 * hora — grid + panel lateral + mini-calendario — donde converge la demanda
 * (requisición) con la cobertura (asignaciones). La cinta de fechas es
 * CONTINUA: todas las semanas del hotel cargan de una vez (§ `scheduleApi`) y
 * arrastrar revela las vecinas en vivo, igual que la vista Días del
 * Timesheet — decisión de Hugo tras notar que el paginado (heredado de la
 * vista Horas) no se sentía como el resto del sistema. La cobertura es POR
 * POSICIÓN — el contrato aún no liga la entrada del schedule con la posición,
 * así que el bloque del turno no se tiñe por cobertura (sería inventar ese
 * vínculo); el resumen de cobertura arriba y en el panel SÍ usa datos reales.
 */
export function SchedulePage(): ReactNode {
  const { t, i18n } = useLingui()
  const can = useCan()
  const [requestedWeek, setRequestedWeek] = useState<string>(ANY_VALUE)
  const [selection, setSelection] = useState<ScheduleShiftSelection | null>(null)
  const [isAddShiftOpen, setIsAddShiftOpen] = useState(false)

  const { data: timeline, isLoading, isError, refetch } = useGetScheduleTimelineQuery()

  /** La semana en la ventana: la pedida si existe; si no, la más reciente. */
  const selectedWeek = timeline ? resolveWeek(timeline.availableWeeks, requestedWeek) : null

  function selectWeek(target: string): void {
    setRequestedWeek(target)
    setSelection(null)
  }

  function pickDay(date: string): void {
    if (!timeline) return
    const target = weekContaining(timeline.availableWeeks, date)
    if (target) selectWeek(target)
  }

  const coverage =
    timeline && timeline.totalSlots > 0
      ? Math.round((timeline.filledSlots / timeline.totalSlots) * 100)
      : 0
  const holes = timeline ? timeline.totalSlots - timeline.filledSlots : 0
  /** El mes que enseña el mini-calendario: el del jueves de la semana (ISO 8601). */
  const calendarMonth = selectedWeek ? addDaysIso(selectedWeek, 3).slice(0, 7) : ''

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text={t`Schedule del hotel`} />
          </h1>
          <p className="mt-1.5 text-sm text-ink-3">
            {timeline && selectedWeek !== null
              ? t`${timeline.hotelName} · Semana ${formatWeekRange(selectedWeek, addDaysIso(selectedWeek, 6))}`
              : t`Demanda y cobertura de la semana`}
            {IS_DEV_UI && <code className="text-ink-4"> · operations.schedule</code>}
          </p>
        </div>
        {/* Antes esto solo se podía por API/Postman — ni un botón en el front. */}
        {can('schedule:update') && timeline && (
          <Button
            variant="secondary"
            onClick={() => {
              setIsAddShiftOpen(true)
            }}
          >
            <Trans>Agregar turno</Trans>
          </Button>
        )}
      </header>

      {timeline && (
        <AddShiftDialog
          isOpen={isAddShiftOpen}
          hotelId={timeline.hotelId}
          assignees={timeline.assignees}
          onClose={() => {
            setIsAddShiftOpen(false)
          }}
        />
      )}

      {isError && (
        <LoadError
          message={t`No se pudo cargar el Schedule. Revisa tu conexión e inténtalo de nuevo.`}
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading && !timeline ? (
        <TableSkeleton rows={5} columns={8} />
      ) : (
        timeline &&
        (selectedWeek === null ? (
          <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
            <Trans>
              Este hotel todavía no tiene Schedule. En cuanto se programe una semana, aparece aquí.
            </Trans>
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <WeekNavigator
                weekStart={selectedWeek}
                availableWeeks={timeline.availableWeeks}
                onSelect={selectWeek}
              />
              <p className="rounded-md bg-surface-2 px-3 py-2 text-sm text-ink-2">
                <Trans>
                  Semana: <span className="font-semibold">{coverage}% cubierto</span> ·{' '}
                  <Plural value={holes} one="# hueco" other="# huecos" /> — se asignan desde la
                  Bolsa de la Reclutadora
                </Trans>
              </p>
            </div>

            <WeekSlider
              weekStart={selectedWeek}
              availableWeeks={timeline.availableWeeks}
              stepWidth={7 * COLUMN_WIDTH}
              totalDays={timeline.days.length}
              /* Cinta continua, como Días del Timesheet: arrastrar revela
                 fechas vecinas en vivo, sin remontar el grid por semana. */
              continuous
              /* La rejilla scrollea horizontal por sí misma en táctil: el
                 dedo scrollea y la navegación queda en ‹ ›, igual que Días. */
              allowTouchDrag={false}
              onNavigate={selectWeek}
            >
              <div className="flex flex-col gap-4 lg:flex-row">
                <ScheduleTimelineGrid
                  timeline={timeline}
                  selectedWeek={selectedWeek}
                  columnWidth={COLUMN_WIDTH}
                  selectedKey={selection?.key ?? null}
                  onSelectBlock={setSelection}
                />

                <aside className="flex shrink-0 flex-col gap-4 lg:w-80">
                  {selection === null ? (
                    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-line bg-surface p-5">
                      <p className="text-sm text-ink-3">
                        <Trans>Elige un turno para ver a sus colaboradores.</Trans>
                      </p>
                      <div className="flex flex-col gap-2 border-t border-line pt-3">
                        <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
                          <Trans>Demanda de la semana</Trans>
                          {IS_DEV_UI && (
                            <span className="font-normal text-ink-4"> · demand.position</span>
                          )}
                        </p>
                        {timeline.demand.length === 0 ? (
                          <p className="text-sm text-ink-3">
                            <Trans>
                              No hay requisiciones autorizadas para esta semana. Cuando un Manager
                              autorice una, sus posiciones aparecerán aquí.
                            </Trans>
                          </p>
                        ) : (
                          <ul className="flex flex-col gap-2">
                            {timeline.demand.map((row) => (
                              <li
                                key={row.positionId}
                                className="flex items-center justify-between gap-2"
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium text-ink">
                                    {row.name}
                                  </span>
                                  <span className="block truncate text-xs text-ink-3">
                                    <Trans>
                                      {row.startTime} · demanda {row.quantity}
                                    </Trans>
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
                                  {i18n._(coverageLabel(row.filled, row.quantity))}
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
                          <Trans>Turno elegido</Trans>
                        </p>
                        <p className="mt-1 text-lg font-bold text-ink">
                          {formatWeekday(selection.day)} {formatDayNumber(selection.day)} ·{' '}
                          {selection.start} – {selection.end}
                        </p>
                        <p className="text-sm text-ink-3">
                          <Plural
                            value={selection.people.length}
                            one="# colaborador"
                            other="# colaboradores"
                          />
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
                        <Trans>
                          La posición y la requisición del turno se enseñan en la fila de Demanda:
                          el contrato aún no liga el turno con una posición.
                        </Trans>
                      </p>
                    </div>
                  )}

                  <ScheduleMiniCalendar
                    month={calendarMonth}
                    availableWeeks={timeline.availableWeeks}
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
