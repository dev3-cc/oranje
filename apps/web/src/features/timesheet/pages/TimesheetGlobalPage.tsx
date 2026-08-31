import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@oranje/ui'
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
        <MetricCard
          value="—"
          label="Verde · cumplimiento"
          foot="pendiente de horas contractuales"
        />
        <MetricCard
          value="—"
          label="Amarillo · desviación"
          foot="pendiente de horas contractuales"
        />
        <MetricCard value="—" label="Rojo · anomalía" foot="pendiente de horas contractuales" />
      </div>

      {isError && (
        <LoadError
          message="No se pudo cargar la semana del Timesheet Global. Reintenta en unos segundos."
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading && !week ? (
        <TableSkeleton rows={6} columns={7} />
      ) : (
        <div className="rounded-lg border border-line bg-surface">
          <Table className="min-w-[64rem] text-left">
            <TableHeader>
              <TableRow className="border-line">
                {HEADERS.map((header) => (
                  <TableHead
                    key={header}
                    scope="col"
                    className="px-4 py-3 text-xs font-semibold tracking-wide text-ink-3 uppercase"
                  >
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow className="border-line">
                  <TableCell
                    colSpan={HEADERS.length}
                    className="px-4 py-8 text-center text-sm text-ink-3"
                  >
                    Nadie tiene Timesheet esta semana. Las filas aparecen cuando los Supervisores
                    registran horas.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.timesheetId} className="border-line">
                  <TableCell className="px-4 py-3 text-sm font-semibold text-ink">
                    {row.workerName}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-ink-3">
                    {TIMESHEET_WEEK_STATUS_LABEL[row.weekStatus as TimesheetWeekStatus] ??
                      row.weekStatus}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm font-semibold text-ink">
                    {formatHours(row.totalHours)}
                  </TableCell>
                  {}
                  <TableCell className="px-4 py-3 text-sm text-ink-4">—</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-ink-4">—</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-ink-4">—</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-ink-4">—</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-ink-3">
        El Indicador de Cumplimiento del Timesheet lo calcula el sistema comparando el Contrato con
        el Timesheet, sin intervención humana. Las horas contractuales por colaborador{' '}
        <span className="font-semibold">todavía no están disponibles</span>: hasta que lo estén,
        esas columnas muestran una raya en vez de un dato inventado
        {IS_DEV_UI && (
          <code className="text-ink-4"> · pendiente 13 del ADR (duración del turno)</code>
        )}
        . Un Colaborador en Gris (accidente) tampoco se evalúa: queda fuera de la medición semanal.
      </p>
    </div>
  )
}
