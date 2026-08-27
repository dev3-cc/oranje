import { useMemo, useState, type ReactNode } from 'react'

import { useGetTimesheetWeekQuery } from '../api/timesheetApi'
import { ManualPunchDialog } from '../components/ManualPunchDialog'
import { ReviewDayDialog } from '../components/ReviewDayDialog'
import { TimesheetGrid } from '../components/TimesheetGrid'
import { TimesheetToolbar } from '../components/TimesheetToolbar'
import {
  EMPTY_TIMESHEET_FILTERS,
  type TimesheetEntry,
  type TimesheetFilters,
  type TimesheetRow,
} from '../types/timesheet.types'

import { Button } from '@/shared/components/Button'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { DEFAULT_COLUMN_WIDTH } from '@/shared/constants/timesheetStatus'
import { formatWeekRange } from '@/shared/lib/formatters'

/**
 * Timesheet semanal: qué marcó cada persona y en qué punto va su revisión.
 *
 * La selección vive aquí y no en cada celda porque cruza filas: se eligen días
 * de varias personas para actuar sobre todos a la vez, que es de lo que habla
 * el chip «Pagar N» de cada renglón.
 */
export function TimesheetPage(): ReactNode {
  const [filters, setFilters] = useState<TimesheetFilters>(EMPTY_TIMESHEET_FILTERS)
  const [columnWidth, setColumnWidth] = useState<number>(DEFAULT_COLUMN_WIDTH)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  /** El día abierto en Revisión (maqueta del Supervisor); `null` = cerrado. */
  const [review, setReview] = useState<{ entry: TimesheetEntry; workerName: string } | null>(null)
  /** La fila con el diálogo de marca manual abierto; `null` = cerrado. */
  const [manualPunchRow, setManualPunchRow] = useState<TimesheetRow | null>(null)

  const { data: week, isLoading, isError, refetch } = useGetTimesheetWeekQuery(filters)

  function toggle(entryId: string): void {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
  }

  /** De qué requisiciones son los días elegidos. Es lo que resume la selección. */
  const selection = useMemo(() => {
    const entries = (week?.rows ?? []).flatMap((row) =>
      row.entries.filter((entry) => selectedIds.has(entry.id)),
    )

    const withRequisition = entries.filter((entry) => entry.requisitionNumber !== null)
    const numbers = [...new Set(withRequisition.map((entry) => entry.requisitionNumber))]

    return {
      total: entries.length,
      withoutRequisition: entries.length - withRequisition.length,
      numbers,
    }
  }, [week, selectedIds])

  const days = week?.days ?? []
  const rangeLabel =
    days.length > 0 ? formatWeekRange(days[0] ?? '', days[days.length - 1] ?? '') : ''

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          <FoldText text="Timesheet" />
        </h1>
        {/* El rango sale de los días que llegaron, no de un texto aparte: así el
            título no puede decir una semana distinta de la que se ve. */}
        {rangeLabel !== '' && <p className="text-base text-ink-3">Semana {rangeLabel}</p>}
      </header>

      <TimesheetToolbar
        filters={filters}
        requisitionNumbers={week?.requisitionNumbers ?? []}
        hotelNames={week?.hotelNames ?? []}
        columnWidth={columnWidth}
        onChange={setFilters}
        onColumnWidthChange={setColumnWidth}
      />

      {selection.total > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-purple bg-purple/10 px-5 py-3">
          <p className="text-sm font-semibold text-ink">
            {selection.total} {selection.total === 1 ? 'día elegido' : 'días elegidos'}
          </p>
          <p className="text-sm text-ink-2">
            {selection.numbers.length > 0 ? selection.numbers.join(' · ') : 'sin requisición'}
            {selection.withoutRequisition > 0 &&
              selection.numbers.length > 0 &&
              ` · ${String(selection.withoutRequisition)} sin requisición`}
          </p>

          <div className="ml-auto flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedIds(new Set())
              }}
            >
              Limpiar
            </Button>
            {/* Pendiente: falta el diseño del pago en bloque */}
            <Button variant="primary" disabled title="Pendiente: falta el diseño del pago">
              Pagar seleccionados
            </Button>
          </div>
        </div>
      )}

      {isError && (
        <LoadError
          message="No se pudo cargar la semana."
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading && !week ? (
        <TableSkeleton rows={7} columns={8} />
      ) : (
        week && (
          <TimesheetGrid
            week={week}
            columnWidth={columnWidth}
            selectedIds={selectedIds}
            onToggle={toggle}
            onReview={(entry, workerName) => {
              setReview({ entry, workerName })
            }}
            onManualPunch={setManualPunchRow}
          />
        )
      )}

      <ManualPunchDialog
        row={manualPunchRow}
        onClose={() => {
          setManualPunchRow(null)
        }}
      />

      <ReviewDayDialog
        entry={review?.entry ?? null}
        workerName={review?.workerName ?? ''}
        onClose={() => {
          setReview(null)
        }}
      />
    </div>
  )
}
