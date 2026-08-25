import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

import { useGetScheduleWeekQuery } from '../api/scheduleApi'
import type { ScheduleDemandRow } from '../types/schedule.types'

import { LoadError } from '@/shared/components/LoadError'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDayNumber, formatWeekRange, formatWeekday } from '@/shared/lib/formatters'

/** Cómo se pinta la cobertura de una celda. */
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

function DemandRow({ row, days }: { row: ScheduleDemandRow; days: string[] }): ReactNode {
  return (
    <div
      className="grid items-center border-b border-line last:border-b-0"
      style={{ gridTemplateColumns: `240px repeat(${String(days.length)}, minmax(88px, 1fr))` }}
    >
      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-ink">{row.name}</p>
        <p className="text-xs text-ink-3">
          {row.startTime} · demanda {row.quantity}
        </p>
        <p className="text-xs text-ink-4">
          línea {row.lineNumber} · {row.requisitionNumber}
        </p>
      </div>
      {days.map((day) => (
        <div key={day} className="px-1.5 py-2">
          <div
            className={cn(
              'rounded-md px-2 py-1.5 text-center text-xs font-medium',
              coverageTone(row.filled, row.quantity),
            )}
          >
            <span className="block text-sm font-semibold">
              {row.filled}/{row.quantity}
            </span>
            {coverageLabel(row.filled, row.quantity)}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Schedule del hotel (maqueta del Manager de Área): la semana donde converge
 * la demanda (requisición) con la cobertura (asignaciones), y quién está
 * programado cada día. La cobertura es POR POSICIÓN — el contrato aún no liga
 * la entrada del schedule con la posición, así que el desglose por día espera
 * ese vínculo en vez de inventarse.
 */
export function SchedulePage(): ReactNode {
  const { data: week, isLoading, isError, refetch } = useGetScheduleWeekQuery()

  const coverage =
    week && week.totalSlots > 0 ? Math.round((week.filledSlots / week.totalSlots) * 100) : 0
  const holes = week ? week.totalSlots - week.filledSlots : 0

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Schedule del hotel</h1>
        <p className="mt-1.5 text-sm text-ink-3">
          {week && week.days.length > 0
            ? `${week.hotelName} · Semana ${formatWeekRange(week.days[0] ?? '', week.days[6] ?? '')}`
            : 'Demanda y cobertura de la semana'}
          {IS_DEV_UI && <code className="text-ink-4"> · operations.schedule</code>}
        </p>
      </header>

      {isError && (
        <LoadError
          message="No se pudo cargar el schedule."
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading && !week ? (
        <TableSkeleton rows={5} columns={8} />
      ) : (
        week && (
          <>
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
              <div className="min-w-max">
                <div
                  className="grid items-end border-b border-line"
                  style={{
                    gridTemplateColumns: `240px repeat(${String(week.days.length)}, minmax(88px, 1fr))`,
                  }}
                >
                  <div className="px-4 py-3 text-xs font-semibold tracking-wide text-ink-3 uppercase">
                    Posición
                  </div>
                  {week.days.map((day) => (
                    <div key={day} className="px-2 py-2.5 text-center">
                      <p className="text-xs text-ink-3">{formatWeekday(day)}</p>
                      <p className="text-lg font-semibold text-ink">{formatDayNumber(day)}</p>
                    </div>
                  ))}
                </div>

                {week.demand.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-ink-3">
                    Sin demanda autorizada esta semana.
                  </p>
                ) : (
                  week.demand.map((row) => (
                    <DemandRow key={row.positionId} row={row} days={week.days} />
                  ))
                )}
              </div>
            </div>

            <p className="rounded-md bg-surface-2 p-3 text-sm text-ink-2">
              Semana: <span className="font-semibold">{coverage}% cubierto</span> ·{' '}
              {holes === 1 ? '1 hueco' : `${String(holes)} huecos`} — se asignan desde la Bolsa de
              la Reclutadora
              {IS_DEV_UI && (
                <span className="text-xs text-ink-4">
                  {' '}
                  · la cobertura es por posición; el desglose por día espera el vínculo
                  entry→posición en el contrato
                </span>
              )}
            </p>

            <section>
              <h2 className="text-base font-semibold text-ink">
                Programados esta semana
                {IS_DEV_UI && (
                  <span className="font-normal text-ink-4"> · operations.schedule_entry</span>
                )}
              </h2>
              {week.entries.length === 0 ? (
                <p className="mt-2 text-sm text-ink-3">Nadie programado todavía.</p>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {week.days.map((day) => {
                    const ofDay = week.entries.filter((entry) => entry.workDate === day)
                    if (ofDay.length === 0) return null
                    return (
                      <div key={day} className="rounded-lg border border-line bg-surface p-4">
                        <p className="text-sm font-semibold text-ink">
                          {formatWeekday(day)} {formatDayNumber(day)}
                        </p>
                        <ul className="mt-2 flex flex-col gap-1.5">
                          {ofDay.map((entry) => (
                            <li key={entry.id} className="text-sm text-ink-2">
                              {entry.workerName}{' '}
                              <span className="text-xs text-ink-3">· {entry.shift}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )
      )}
    </div>
  )
}
