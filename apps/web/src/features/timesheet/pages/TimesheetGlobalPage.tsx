import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import { filterTimesheetRows, useGetTimesheetWeekQuery } from '../api/timesheetApi'
import { TimesheetToolbar } from '../components/TimesheetToolbar'
import { WeekNavigator } from '../components/TimesheetViewControls'
import { resolveWeek } from '../lib/weekNavigation'
import { ANY_VALUE, EMPTY_TIMESHEET_FILTERS, type TimesheetFilters } from '../types/timesheet.types'

import { LoadError } from '@/shared/components/LoadError'
import { MetricCard } from '@/shared/components/MetricCard'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import {
  DEFAULT_COLUMN_WIDTH,
  WEEK_STATUS_LABEL_WITH_VIRTUAL,
} from '@/shared/constants/timesheetStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatHours, formatWeekRange } from '@/shared/lib/formatters'

const HEADERS: readonly MessageDescriptor[] = [msg`Colaborador`, msg`Semana`, msg`Reales`]

export function TimesheetGlobalPage(): ReactNode {
  const { t, i18n } = useLingui()
  /** Los mismos cuatro filtros de `/timesheet`: colaborador, requisición, estado y hotel. */
  const [filters, setFilters] = useState<TimesheetFilters>(EMPTY_TIMESHEET_FILTERS)
  /**
   * El zoom es de la rejilla de Días y aquí no hay rejilla: no se enseña
   * (`showZoom={false}`). El estado existe solo porque el toolbar hoy lo pide.
   */
  const [columnWidth, setColumnWidth] = useState<number>(DEFAULT_COLUMN_WIDTH)

  const { data: week, isLoading, isError, refetch } = useGetTimesheetWeekQuery(filters)

  /* `week.rows` ya no viene filtrada por hotel/búsqueda/requisición — filtrar
     eso dejó de pedir red (ver `getTimesheetWeek` en `timesheetApi.ts`). */
  const rows = filterTimesheetRows(week?.rows ?? [], filters)
  const rangeLabel =
    week && week.days.length > 0
      ? formatWeekRange(week.days[0] ?? '', week.days[week.days.length - 1] ?? '')
      : ''
  /* Sin esto, esta pantalla se quedaba fija en la semana más reciente: no
     había forma de ver una semana pasada (Hugo, 2026-10-13). Mismo
     navegador que ya usa Asistencia, sobre las mismas semanas de
     `fetchWeek` — nunca se desincroniza con la tabla de abajo. */
  const availableWeeks = week?.availableWeeks ?? []
  const selectedWeek = resolveWeek(availableWeeks, filters.weekStart)
  function selectWeek(target: string): void {
    setFilters((previous) => ({ ...previous, weekStart: target }))
  }
  const hasFilters =
    filters.search.trim() !== '' ||
    filters.requisitionNumber !== ANY_VALUE ||
    filters.status !== ANY_VALUE ||
    filters.hotelName !== ANY_VALUE

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          <Trans>Timesheet Global · Cumplimiento</Trans>
        </h1>
        <p className="mt-1.5 text-sm text-ink-3">
          {rangeLabel !== '' && `${t`Semana ${rangeLabel}`} · `}
          <Trans>El Manager General ve todos los departamentos</Trans>
          {IS_DEV_UI ? ' (D-09)' : ''}
        </p>
        {selectedWeek !== null && (
          <div className="mt-3">
            <WeekNavigator
              weekStart={selectedWeek}
              availableWeeks={availableWeeks}
              onSelect={selectWeek}
            />
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          value={String(rows.length)}
          label={t`Colaboradores evaluados`}
          foot={t`con timesheet esta semana`}
        />
        <MetricCard
          value="—"
          label={t`Verde · cumplimiento`}
          foot={t`pendiente de horas contractuales`}
        />
        <MetricCard
          value="—"
          label={t`Amarillo · desviación`}
          foot={t`pendiente de horas contractuales`}
        />
        <MetricCard
          value="—"
          label={t`Rojo · anomalía`}
          foot={t`pendiente de horas contractuales`}
        />
      </div>

      <TimesheetToolbar
        filters={filters}
        requisitionNumbers={week?.requisitionNumbers ?? []}
        hotelNames={week?.hotelNames ?? []}
        columnWidth={columnWidth}
        showZoom={false}
        onChange={setFilters}
        onColumnWidthChange={setColumnWidth}
      />

      {isError && (
        <LoadError
          message={t`No se pudo cargar la semana del Timesheet Global. Reintenta en unos segundos.`}
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading && !week ? (
        <TableSkeleton rows={6} columns={7} />
      ) : (
        <div className="rounded-lg border border-line bg-surface">
          <Table className="min-w-[32rem] text-left">
            <TableHeader>
              <TableRow className="border-line">
                {HEADERS.map((header) => (
                  <TableHead
                    key={header.id}
                    scope="col"
                    className="px-4 py-3 text-xs font-semibold tracking-wide text-ink-3 uppercase"
                  >
                    {i18n._(header)}
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
                    {hasFilters
                      ? t`Nadie coincide con esos filtros. Cambia el nombre, la requisición, el estado o el hotel.`
                      : t`Nadie tiene Timesheet esta semana. Las filas aparecen cuando los Supervisores registran horas.`}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.timesheetId} className="border-line">
                  <TableCell className="px-4 py-3 text-sm font-semibold text-ink">
                    {row.workerName}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-ink-3">
                    {WEEK_STATUS_LABEL_WITH_VIRTUAL[row.weekStatus] ?? row.weekStatus}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm font-semibold text-ink">
                    {formatHours(row.totalHours)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-ink-3">
        <Trans>
          El Indicador de Cumplimiento del Timesheet lo calcula el sistema comparando el Contrato
          con el Timesheet, sin intervención humana. Las horas contractuales por colaborador{' '}
          <span className="font-semibold">todavía no están disponibles</span>: hasta que lo estén,
          esas columnas muestran una raya en vez de un dato inventado
          {IS_DEV_UI && (
            <code className="text-ink-4"> · pendiente 13 del ADR (duración del turno)</code>
          )}
          . Un Colaborador en Gris (accidente) tampoco se evalúa: queda fuera de la medición
          semanal.
        </Trans>
      </p>
    </div>
  )
}
