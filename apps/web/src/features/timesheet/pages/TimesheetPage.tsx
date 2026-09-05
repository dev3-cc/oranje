import { statusLight } from '@oranje/ui'
import { useMemo, useState, type ReactNode } from 'react'

import {
  useGetTimesheetMonthQuery,
  useGetTimesheetTimelineQuery,
  useGetTimesheetWeekQuery,
} from '../api/timesheetApi'
import { ManualPunchDialog } from '../components/ManualPunchDialog'
import { ReviewDayDialog } from '../components/ReviewDayDialog'
import { TimesheetGrid } from '../components/TimesheetGrid'
import { TimesheetHoursView } from '../components/TimesheetHoursView'
import { TimesheetMonthView } from '../components/TimesheetMonthView'
import { TimesheetToolbar } from '../components/TimesheetToolbar'
import {
  TimesheetViewToggle,
  WeekNavigator,
  type TimesheetView,
} from '../components/TimesheetViewControls'
import { WeekSlider } from '../components/WeekSlider'
import { addDaysIso, resolveWeek } from '../lib/weekNavigation'
import {
  ANY_VALUE,
  EMPTY_TIMESHEET_FILTERS,
  type ReviewContext,
  type TimesheetEntry,
  type TimesheetFilters,
  type TimesheetRow,
} from '../types/timesheet.types'

import { Button } from '@/shared/components/Button'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import {
  DEFAULT_COLUMN_WIDTH,
  TIMESHEET_STATUS_LABEL,
  TIMESHEET_STATUS_TOKEN,
  TIMESHEET_STATUSES,
} from '@/shared/constants/timesheetStatus'
import { useCan } from '@/shared/hooks/useCan'
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
  /** Densidad de la semana: la rejilla de chips o el lienzo de horas. */
  const [view, setView] = useState<TimesheetView>('DAYS')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  /** El día abierto en Revisión (maqueta del Supervisor); `null` = cerrado. */
  const [review, setReview] = useState<{
    entry: TimesheetEntry
    workerName: string
    context: ReviewContext | null
    /** Con qué abrir Marca manual si la piden desde aquí mismo. */
    manualPunchTarget: Pick<TimesheetRow, 'requisitionId' | 'workerId' | 'workerName'>
  } | null>(null)
  /** La fila con el diálogo de marca manual abierto; `null` = cerrado. */
  const [manualPunchRow, setManualPunchRow] = useState<Pick<
    TimesheetRow,
    'requisitionId' | 'workerId' | 'workerName'
  > | null>(null)
  /** El día a precargar cuando Marca manual se abrió desde Revisión del día. */
  const [manualPunchInitialDate, setManualPunchInitialDate] = useState<string | null>(null)

  const can = useCan()
  /** Pagar es de Contabilidad (doble firma del Flujo de Nómina), no del Hotel. */
  const canPay = can('payroll:validate') || can('payroll:authorize')

  const { data: week, isLoading, isError, refetch } = useGetTimesheetWeekQuery(filters)
  /**
   * La CINTA para la vista Días: todas las semanas de una vez. `weekStart` va
   * fijo en ALL para que navegar NO cambie la llave de caché — moverse de
   * semana es mover la ventana, no pedir datos.
   */
  const { data: timeline } = useGetTimesheetTimelineQuery({ ...filters, weekStart: ANY_VALUE })
  /** El agregado del mes solo se pide cuando la vista Mes está a la vista. */
  const { data: month } = useGetTimesheetMonthQuery(filters, { skip: view !== 'MONTH' })

  const availableWeeks = timeline?.availableWeeks ?? week?.availableWeeks ?? []
  /** La semana en la ventana: la pedida si existe; si no, la más reciente. */
  const selectedWeek = resolveWeek(availableWeeks, filters.weekStart)

  function toggle(entryId: string): void {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
  }

  /** De qué requisiciones son los días elegidos. Es lo que resume la selección.
      Se busca en la CINTA: un día elegido puede ser de una semana vecina. */
  const selection = useMemo(() => {
    const entries = (timeline?.rows ?? week?.rows ?? []).flatMap((row) =>
      row.entries.filter((entry) => selectedIds.has(entry.id)),
    )

    const withRequisition = entries.filter((entry) => entry.requisitionNumber !== null)
    const numbers = [...new Set(withRequisition.map((entry) => entry.requisitionNumber))]

    return {
      total: entries.length,
      withoutRequisition: entries.length - withRequisition.length,
      numbers,
    }
  }, [timeline, week, selectedIds])

  /** El rango sale de la semana en la ventana: navega al instante con la cinta. */
  const rangeLabel =
    selectedWeek !== null ? formatWeekRange(selectedWeek, addDaysIso(selectedWeek, 6)) : ''

  /** Cambiar de semana es un filtro más. */
  function selectWeek(target: string): void {
    setFilters((previous) => ({ ...previous, weekStart: target }))
  }

  /** Del mes a la semana: picar un día abre su semana en la vista Días. */
  function pickMonthDay(date: string): void {
    const target = availableWeeks.find((start) => start <= date && date <= addDaysIso(start, 6))
    if (target) selectWeek(target)
    setView('DAYS')
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text="Timesheet" />
          </h1>
          {/* El rango sale de los días que llegaron, no de un texto aparte: así el
              título no puede decir una semana distinta de la que se ve. */}
          {rangeLabel !== '' && <p className="text-base text-ink-3">Semana {rangeLabel}</p>}
        </div>

        {selectedWeek !== null && (
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <WeekNavigator
              weekStart={selectedWeek}
              availableWeeks={availableWeeks}
              onSelect={selectWeek}
            />
            <TimesheetViewToggle view={view} onChange={setView} />
          </div>
        )}
      </header>

      <TimesheetToolbar
        filters={filters}
        requisitionNumbers={week?.requisitionNumbers ?? []}
        hotelNames={week?.hotelNames ?? []}
        columnWidth={columnWidth}
        showZoom={view === 'DAYS'}
        onChange={setFilters}
        onColumnWidthChange={setColumnWidth}
      />

      {/* La leyenda de los estados del día: el color nunca habla solo. */}
      {week && week.rows.length > 0 && view !== 'MONTH' && (
        <div className="-mt-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
          {TIMESHEET_STATUSES.map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5 text-xs text-ink-3">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: statusLight[TIMESHEET_STATUS_TOKEN[status]] }}
                aria-hidden
              />
              {TIMESHEET_STATUS_LABEL[status]}
            </span>
          ))}
          {/* El contorno del carril también se explica en la leyenda. */}
          {view === 'DAYS' && (
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
              <span className="h-3.5 w-6 rounded-md border border-o-500/50" aria-hidden />
              Días de una misma requisición
            </span>
          )}
        </div>
      )}

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

          <div className="ml-auto flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedIds(new Set())
              }}
            >
              Quitar selección
            </Button>
            {/* Pagar NO es del Hotel: doble firma de Contabilidad (Flujo de
                Nómina). Quien no puede no ve un botón muerto — ve quién sí,
                que es el patrón acordado del barrido de permisos. */}
            {canPay ? (
              <Button variant="primary" disabled title="El pago en bloque aún no está disponible">
                Pagar seleccionados
              </Button>
            ) : (
              <span className="rounded-md border border-dashed border-line px-2.5 py-1 text-xs text-ink-3">
                El pago lo hace Contabilidad cuando la semana está aprobada
              </span>
            )}
          </div>
        </div>
      )}

      {isError && (
        <LoadError
          message="No se pudo cargar la semana del Timesheet. Reintenta en unos segundos."
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading && !week ? (
        <TableSkeleton rows={7} columns={8} />
      ) : (
        selectedWeek !== null &&
        week && (
          <WeekSlider
            weekStart={selectedWeek}
            availableWeeks={availableWeeks}
            /* La unidad del carrusel: una semana completa en px (7 columnas). */
            stepWidth={7 * columnWidth}
            totalDays={timeline?.days.length ?? 7}
            /* Solo Días dibuja la cinta completa: ahí el arrastre es continuo. */
            continuous={view === 'DAYS'}
            /* La rejilla de Días scrollea horizontal por sí misma: ahí el dedo
               scrollea y la navegación táctil queda en ‹ ›; en Horas y Mes el
               swipe sí navega. */
            allowTouchDrag={view !== 'DAYS'}
            onNavigate={selectWeek}
          >
            {view === 'DAYS' &&
              (timeline ? (
                <TimesheetGrid
                  timeline={timeline}
                  selectedWeek={selectedWeek}
                  columnWidth={columnWidth}
                  selectedIds={selectedIds}
                  selectable={canPay}
                  onToggle={toggle}
                  onReview={(entry, workerName, context, manualPunchTarget) => {
                    setReview({ entry, workerName, context: context ?? null, manualPunchTarget })
                  }}
                  onManualPunch={(row) => {
                    setManualPunchRow(row)
                    setManualPunchInitialDate(null)
                  }}
                />
              ) : (
                <TableSkeleton rows={7} columns={8} />
              ))}
            {view === 'HOURS' &&
              (timeline ? (
                <TimesheetHoursView
                  timeline={timeline}
                  selectedWeek={selectedWeek}
                  onReview={(entry, workerName, context, manualPunchTarget) => {
                    setReview({ entry, workerName, context: context ?? null, manualPunchTarget })
                  }}
                />
              ) : (
                <TableSkeleton rows={7} columns={8} />
              ))}
            {view === 'MONTH' &&
              (month ? (
                <TimesheetMonthView month={month} onPickDay={pickMonthDay} />
              ) : (
                <TableSkeleton rows={5} columns={7} />
              ))}
          </WeekSlider>
        )
      )}

      <ManualPunchDialog
        row={manualPunchRow}
        initialDate={manualPunchInitialDate}
        onClose={() => {
          setManualPunchRow(null)
          setManualPunchInitialDate(null)
        }}
      />

      <ReviewDayDialog
        entry={review?.entry ?? null}
        workerName={review?.workerName ?? ''}
        context={review?.context ?? null}
        onManualPunch={
          review
            ? () => {
                setManualPunchRow(review.manualPunchTarget)
                setManualPunchInitialDate(review.entry.date)
                setReview(null)
              }
            : undefined
        }
        onClose={() => {
          setReview(null)
        }}
      />
    </div>
  )
}
