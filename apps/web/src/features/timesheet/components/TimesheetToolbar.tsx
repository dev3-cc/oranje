import { Trans, useLingui } from '@lingui/react/macro'
import {
  cn,
  MaterialIcon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@oranje/ui'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { useGetTimesheetWeekQuery } from '../api/timesheetApi'
import { ANY_VALUE, type TimesheetFilters as Filters } from '../types/timesheet.types'

import { DateRangeField, hasRange } from '@/shared/components/DateRangeField'
import { FilterReset } from '@/shared/components/FilterReset'
import { SearchField } from '@/shared/components/SearchField'
import {
  COLUMN_WIDTHS,
  TIMESHEET_WEEK_STATUS_LABEL,
  TIMESHEET_WEEK_STATUSES,
} from '@/shared/constants/timesheetStatus'
import { useDebounce } from '@/shared/hooks/useDebounce'

function LabeledControl({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <label className="flex min-w-48 flex-col gap-1.5">
      <span className="text-xs text-ink-3">{label}</span>
      {children}
    </label>
  )
}

export function TimesheetToolbar({
  filters,
  requisitionNumbers,
  hotelNames,
  columnWidth,
  showZoom = true,
  hideHotelFilter = false,
  onChange,
  onColumnWidthChange,
}: {
  filters: Filters
  requisitionNumbers: string[]
  hotelNames: string[]
  columnWidth: number
  /** El zoom es un concepto de la vista Días: en Horas y Mes no se enseña. */
  showZoom?: boolean
  /** `true` cuando la página ya puso su propio filtro de Hotel más arriba,
      junto al navegador de semana (Hugo, 2026-10-14): uno solo, no dos. */
  hideHotelFilter?: boolean
  onChange: (filters: Filters) => void
  onColumnWidthChange: (width: number) => void
}): ReactNode {
  const { t } = useLingui()
  /* En móvil los cuatro controles apilados ocupaban la pantalla entera antes
     de ver un solo dato (Hugo, 2026-10-12, con captura). Mismo patrón que
     Contratos: un botón «Filtrar» los oculta, y con un filtro puesto se
     quedan abiertos para poder quitarlo — en escritorio (`lg+`) siguen en
     una sola fila, sin tocar nada. */
  const [isFiltersOpen, setFiltersOpen] = useState(false)
  const update =
    <K extends keyof Filters>(key: K) =>
    (value: string): void => {
      onChange({ ...filters, [key]: value })
    }

  /*
   * El buscador responde al instante y la consulta espera: el texto vive aquí
   * como borrador y solo el valor asentado (300 ms sin teclear) sube a
   * `filters.search`, que es lo que va al servidor. Los selects no esperan:
   * elegir uno es una sola acción, no una ráfaga.
   */
  const [draft, setDraft] = useState(filters.search)
  const settledSearch = useDebounce(draft)
  /* La misma llave de caché que la página: cero consultas extra, solo el
     estado. Mientras el texto no ha asentado o la semana nueva viene en
     vuelo, el campo enseña el Spinner — la rejilla vieja ya no «se queda
     quieta» sin avisar (regla de la skill: indicador si pasa de 300 ms). */
  const { isFetching } = useGetTimesheetWeekQuery(filters)
  const isSearching = draft.trim() !== '' && (draft.trim() !== filters.search.trim() || isFetching)
  /* Props frescas para el efecto SIN depender de ellas: si dependiera de
     `filters`, cambiar un select re-enviaría el texto asentado viejo. */
  const latest = useRef({ filters, onChange })
  useEffect(() => {
    latest.current = { filters, onChange }
  })
  useEffect(() => {
    const { filters: current, onChange: emit } = latest.current
    if (settledSearch !== current.search) emit({ ...current, search: settledSearch })
  }, [settledSearch])
  /* Si la búsqueda cambia desde fuera (el padre la resetea), el borrador la sigue. */
  useEffect(() => {
    setDraft(filters.search)
  }, [filters.search])

  /* La semana (`weekStart`) es navegación, no filtro: ni cuenta ni se quita. */
  const activeFilters =
    (draft.trim() !== '' ? 1 : 0) +
    /* El periodo SÍ es filtro —acota lo que se ve— a diferencia de la semana,
       que es navegación. Cuenta como uno aunque tenga dos extremos. */
    (hasRange({ from: filters.from, to: filters.to }) ? 1 : 0) +
    [filters.requisitionNumber, filters.status, filters.hotelName].filter(
      (value) => value !== ANY_VALUE,
    ).length

  /* Abiertos si se tocó el botón O ya hay algo puesto — igual que Contratos:
     con un filtro activo, no se puede esconder sin antes quitarlo. */
  const showFiltersOnMobile = isFiltersOpen || activeFilters > 0

  const resetFilters = (): void => {
    setDraft('')
    onChange({
      ...filters,
      search: '',
      requisitionNumber: ANY_VALUE,
      status: ANY_VALUE,
      hotelName: ANY_VALUE,
      from: '',
      to: '',
    })
  }

  return (
    /* Los filtros viven en su propia tarjeta: una franja, no piezas sueltas. */
    <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3 rounded-xl border border-line bg-surface px-4 py-3">
      {/* Solo en móvil: en escritorio los cuatro controles ya caben en una
          fila y este botón no hace falta. */}
      <button
        type="button"
        aria-expanded={showFiltersOnMobile}
        onClick={() => {
          setFiltersOpen((open) => !open)
        }}
        className="flex w-full cursor-pointer items-center justify-between gap-2 text-sm font-semibold text-ink lg:hidden"
      >
        <span className="flex items-center gap-1.5">
          <MaterialIcon name="filter_list" className="text-base" aria-hidden />
          <Trans>Filtrar</Trans>
          {activeFilters > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-o-500 text-xs font-bold text-ink">
              {activeFilters}
            </span>
          )}
        </span>
        <MaterialIcon
          name={showFiltersOnMobile ? 'expand_less' : 'expand_more'}
          className="text-xl text-ink-3"
          aria-hidden
        />
      </button>

      <div
        className={cn(
          'flex-wrap items-end gap-3',
          showFiltersOnMobile ? 'flex' : 'hidden',
          'lg:flex',
        )}
      >
        <SearchField
          isSearching={isSearching}
          value={draft}
          onChange={setDraft}
          label={t`Buscar colaborador`}
          placeholder={t`Nombre del colaborador, p. ej. Ana Rivera…`}
          /* `min-w-0`: el `min-w-60` de base no se encoge dentro del
             acordeón «Filtrar» en móvil y el campo se desbordaba del panel
             (Hugo, 2026-10-14, con captura). En escritorio sigue ocupando
             todo lo que sobra, por el `flex-1`. */
          className="min-w-0 flex-1"
        />

        <LabeledControl label={t`Requisición`}>
          <Select value={filters.requisitionNumber} onValueChange={update('requisitionNumber')}>
            <SelectTrigger aria-label={t`Requisición`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">
                <Trans>Todas</Trans>
              </SelectItem>
              {requisitionNumbers.map((number) => (
                <SelectItem key={number} value={number}>
                  {number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LabeledControl>

        <LabeledControl label={t`Estado`}>
          <Select value={filters.status} onValueChange={update('status')}>
            <SelectTrigger aria-label={t`Estado`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">
                <Trans>Todos los estados</Trans>
              </SelectItem>
              {TIMESHEET_WEEK_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {TIMESHEET_WEEK_STATUS_LABEL[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LabeledControl>

        {!hideHotelFilter && (
          <LabeledControl label={t`Hotel`}>
            <Select value={filters.hotelName} onValueChange={update('hotelName')}>
              <SelectTrigger aria-label={t`Hotel`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  <Trans>Todos los hoteles</Trans>
                </SelectItem>
                {hotelNames.map((hotel) => (
                  <SelectItem key={hotel} value={hotel}>
                    {hotel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </LabeledControl>
        )}

        <LabeledControl label={t`Periodo`}>
          <DateRangeField
            value={{ from: filters.from, to: filters.to }}
            onChange={(range) => {
              onChange({ ...filters, ...range })
            }}
            label={t`del Timesheet`}
          />
        </LabeledControl>

        <FilterReset activeCount={activeFilters} onReset={resetFilters} />
      </div>

      {showZoom && (
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-xs text-ink-3">
            <Trans>Zoom · ancho de columna</Trans>
          </span>
          <div
            role="group"
            aria-label={t`Ancho de columna`}
            className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1"
          >
            {COLUMN_WIDTHS.map((width) => (
              <button
                key={width}
                type="button"
                aria-pressed={width === columnWidth}
                onClick={() => {
                  onColumnWidthChange(width)
                }}
                className={cn(
                  'cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
                  width === columnWidth ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:text-ink',
                )}
              >
                {width}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
