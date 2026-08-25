import type { ReactNode } from 'react'

import { useGetTimesheetWeekQuery } from '../api/timesheetApi'
import { EMPTY_TIMESHEET_FILTERS } from '../types/timesheet.types'

import { LoadError } from '@/shared/components/LoadError'
import { MetricCard } from '@/shared/components/MetricCard'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import {
  TIMESHEET_WEEK_STATUS_LABEL,
  type TimesheetWeekStatus,
} from '@/shared/constants/timesheetStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatHours, formatWeekRange } from '@/shared/lib/formatters'

const HEADERS = [
  'Colaborador',
  'Semana',
  'Reales',
  'Contractuales',
  'Diferencia',
  'Cumplimiento',
  'Indicador',
]

export function TimesheetGlobalPage(): ReactNode {
  const {
    data: week,
    isLoading,
    isError,
    refetch,
  } = useGetTimesheetWeekQuery(EMPTY_TIMESHEET_FILTERS)

  const rows = week?.rows ?? []
  const rangeLabel =
    week && week.days.length > 0
      ? formatWeekRange(week.days[0] ?? '', week.days[week.days.length - 1] ?? '')
      : ''

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          Timesheet Global · Cumplimiento
        </h1>
        <p className="mt-1.5 text-sm text-ink-3">
          {rangeLabel !== '' && `Semana ${rangeLabel} · `}
          El Manager General ve todos los departamentos{IS_DEV_UI ? ' (D-09)' : ''}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          value={String(rows.length)}
          label="Colaboradores evaluados"
          foot="con timesheet esta semana"
        />
        <MetricCard value="—" label="Verde · cumplimiento" foot="espera horas contractuales" />
        <MetricCard value="—" label="Amarillo · desviación" foot="espera horas contractuales" />
        <MetricCard value="—" label="Rojo · anomalía" foot="espera horas contractuales" />
      </div>

      {isError && (
        <LoadError
          message="No se pudo cargar la semana."
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading && !week ? (
        <TableSkeleton rows={6} columns={7} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[64rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {HEADERS.map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="px-4 py-3 text-xs font-semibold tracking-wide text-ink-3 uppercase"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={HEADERS.length} className="px-4 py-8 text-center text-sm text-ink-3">
                    Sin timesheets esta semana.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.timesheetId} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-3 text-sm font-semibold whitespace-nowrap text-ink">
                    {row.workerName}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap text-ink-3">
                    {TIMESHEET_WEEK_STATUS_LABEL[row.weekStatus as TimesheetWeekStatus] ??
                      row.weekStatus}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-ink">
                    {formatHours(row.totalHours)}
                  </td>
                  {}
                  <td className="px-4 py-3 text-sm text-ink-4">—</td>
                  <td className="px-4 py-3 text-sm text-ink-4">—</td>
                  <td className="px-4 py-3 text-sm text-ink-4">—</td>
                  <td className="px-4 py-3 text-sm text-ink-4">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-ink-3">
        El indicador de cumplimiento lo calcula el sistema comparando el Contrato contra el
        Timesheet, sin intervención humana. Las horas contractuales por colaborador{' '}
        <span className="font-semibold">aún no viajan en el contrato de la API</span>: hasta que el
        backend las exponga, esas columnas quedan en raya en vez de inventarse
        {IS_DEV_UI && (
          <code className="text-ink-4"> · pendiente 13 del ADR (duración del turno)</code>
        )}
        . El GRIS del semáforo del Colaborador tampoco evalúa: un accidentado queda fuera de la
        medición semanal.
      </p>
    </div>
  )
}
