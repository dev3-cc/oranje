import { Trans, useLingui } from '@lingui/react/macro'
import { cn, MaterialIcon } from '@oranje/ui'
import { type ReactNode, useState } from 'react'

import { share, weekRangeOf } from '../lib/cohortFormat'
import {
  addWeeks,
  buildPresence,
  cohortSizes,
  firstWeekOf,
  type Granularity,
  mondayOf,
  retentionAt,
  retentionTable,
  type Window,
} from '../lib/cohorts'

import { CohortSection, Stat } from './CohortSection'
import { PeopleNotice } from './PeopleView'
import { TruncatedNotice } from './TabParts'

import { formatPercent } from '@/shared/lib/formatters'
import type { RequisitionApi, TimesheetApi, WorkerApi } from '@/shared/types/apiContract.types'

/** El ancho de la ventana de tiempo, en semanas. */
const WINDOW_WEEKS = 12

const ALL_HOTELS = 'ALL'

/**
 * «Ingresos» en Colaborador: qué pasó con quienes empezaron a trabajar en una
 * semana, y la retención por cohorte semanal o mensual.
 */
export function CohortsView({
  timesheets,
  truncated,
  workers,
  requisitions,
}: {
  timesheets: TimesheetApi[]
  truncated: boolean
  workers: WorkerApi[]
  requisitions: RequisitionApi[]
}): ReactNode {
  const { i18n, t } = useLingui()
  const currentWeek = mondayOf(new Date().toLocaleDateString('en-CA'))
  const [granularity, setGranularity] = useState<Granularity>('week')
  const [hotelId, setHotelId] = useState<string>(ALL_HOTELS)
  /* La ventana se guarda por su primer lunes; termina 11 semanas después o hoy. */
  const [windowFrom, setWindowFrom] = useState(() => addWeeks(currentWeek, -(WINDOW_WEEKS - 1)))
  const windowTo = [addWeeks(windowFrom, WINDOW_WEEKS - 1), currentWeek].sort()[0] as string
  const range: Window = { from: windowFrom, to: windowTo }
  const isPresent = windowTo === currentWeek

  const hotelByRequisition = new Map(
    requisitions.map((requisition) => [requisition.id, requisition.hotel]),
  )
  const hotelOf = new Map(
    requisitions.map((requisition) => [requisition.id, requisition.hotel.name]),
  )
  /* Los hoteles que tienen ponches, con su primera semana: «desde cuándo poncha». */
  const hotelStarts = new Map<string, { id: string; name: string; firstWeek: string }>()
  for (const sheet of timesheets) {
    const hotel = hotelByRequisition.get(sheet.requisitionId)
    if (!hotel) continue
    const week = mondayOf(sheet.weekStart)
    const known = hotelStarts.get(hotel.id)
    if (!known || week < known.firstWeek) {
      hotelStarts.set(hotel.id, { id: hotel.id, name: hotel.name, firstWeek: week })
    }
  }
  const hotels = [...hotelStarts.values()].sort((a, b) => a.name.localeCompare(b.name))
  const hotel = hotelStarts.get(hotelId) ?? null

  const presence = buildPresence(timesheets, hotelOf, (sheet) =>
    hotel === null ? true : hotelByRequisition.get(sheet.requisitionId)?.id === hotel.id,
  )
  const firstWeek = firstWeekOf(presence)
  const workersById = new Map(workers.map((worker) => [worker.id, worker]))
  const sizes = cohortSizes(presence, range)

  const moveTo = (from: string): void => {
    const latest = addWeeks(currentWeek, -(WINDOW_WEEKS - 1))
    const earliest = firstWeek ?? latest
    setWindowFrom(from > latest ? latest : from < earliest && earliest < latest ? earliest : from)
  }

  const retention = retentionTable(presence, granularity, currentWeek, range)
  const columns = Math.max(0, ...retention.map((row) => row.cells.length))
  const monthLabel = (month: string): string =>
    new Date(`${month}-01T00:00:00Z`).toLocaleDateString(i18n.locale, {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })

  const at1 = retentionAt(presence, 1, currentWeek, range)
  const at4 = retentionAt(presence, 4, currentWeek, range)
  const at12 = retentionAt(presence, 12, currentWeek, range)

  return (
    <div className="flex flex-col gap-6">
      <PeopleNotice>
        <Trans>
          «Ingresó» = su primera semana con ponches en todo su historial. «Trabajó» una semana =
          ponchó al menos una vez esa semana; no dice cuántos días. Lo que pasó con quien ya no
          trabaja sale de su estado actual en el Semáforo del Colaborador.
        </Trans>
      </PeopleNotice>
      {truncated && <TruncatedNotice />}

      {/* Moverse en el tiempo: un hotel y la ventana de 12 semanas. */}
      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-ink-3">
            <Trans>Hotel</Trans>
            <select
              id="cohort-hotel"
              value={hotelId}
              onChange={(event) => {
                setHotelId(event.target.value)
              }}
              className="min-h-10 max-w-full rounded-lg border border-line bg-surface px-2 text-sm font-normal text-ink"
            >
              <option value={ALL_HOTELS}>{t`Todos los hoteles`}</option>
              {hotels.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {t`desde ${weekRangeOf(item.firstWeek)}`}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-3">
              <Trans>Ingresos desde la semana del</Trans>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={t`Una semana antes`}
                disabled={firstWeek === null || windowFrom <= firstWeek}
                onClick={() => {
                  moveTo(addWeeks(windowFrom, -1))
                }}
                className="inline-flex size-10 items-center justify-center rounded-lg border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-40"
              >
                <MaterialIcon name="chevron_left" className="text-xl" aria-hidden />
              </button>
              <input
                id="cohort-from"
                type="date"
                value={windowFrom}
                max={currentWeek}
                onChange={(event) => {
                  if (event.target.value) moveTo(mondayOf(event.target.value))
                }}
                className="min-h-10 rounded-lg border border-line bg-surface px-2 text-sm text-ink"
              />
              <button
                type="button"
                aria-label={t`Una semana después`}
                disabled={isPresent}
                onClick={() => {
                  moveTo(addWeeks(windowFrom, 1))
                }}
                className="inline-flex size-10 items-center justify-center rounded-lg border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-40"
              >
                <MaterialIcon name="chevron_right" className="text-xl" aria-hidden />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={firstWeek === null || windowFrom === firstWeek}
              onClick={() => {
                if (firstWeek) moveTo(firstWeek)
              }}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-line px-3 text-sm font-medium text-ink-2 hover:bg-surface-2 disabled:opacity-40"
            >
              <MaterialIcon name="first_page" className="text-lg" aria-hidden />
              {hotel ? t`Cuando empezó a ponchar` : t`Inicio del historial`}
            </button>
            <button
              type="button"
              disabled={isPresent}
              onClick={() => {
                moveTo(addWeeks(currentWeek, -(WINDOW_WEEKS - 1)))
              }}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-line px-3 text-sm font-medium text-ink-2 hover:bg-surface-2 disabled:opacity-40"
            >
              <MaterialIcon name="today" className="text-lg" aria-hidden />
              <Trans>Hoy</Trans>
            </button>
          </div>
        </div>
        <p className="text-sm text-ink-2">
          <Trans>
            Ingresos de {weekRangeOf(range.from)} a {weekRangeOf(range.to)}
          </Trans>
          {hotel && <> · {hotel.name}</>}
          {hotel && (
            <span className="text-ink-3">
              {' '}
              · <Trans>«Ingresó» = su primera semana ponchando en este hotel.</Trans>
            </span>
          )}
        </p>
      </section>

      {/* Retención de las cohortes recientes, en una línea. */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label={<Trans>Regresaron la semana siguiente</Trans>}
          value={at1 ? share(at1.part, at1.whole) : '—'}
          detail={
            at1 && (
              <Trans>
                {at1.part} de {at1.whole}
              </Trans>
            )
          }
          hint={<Trans>Ingresos de la ventana elegida</Trans>}
        />
        <Stat
          label={<Trans>Siguen a las 4 semanas</Trans>}
          value={at4 ? share(at4.part, at4.whole) : '—'}
          detail={
            at4 && (
              <Trans>
                {at4.part} de {at4.whole}
              </Trans>
            )
          }
          hint={<Trans>Trabajaron en su semana 4 · ~30 días</Trans>}
        />
        <Stat
          label={<Trans>Siguen a las 12 semanas</Trans>}
          value={at12 ? share(at12.part, at12.whole) : '—'}
          detail={
            at12 && (
              <Trans>
                {at12.part} de {at12.whole}
              </Trans>
            )
          }
          hint={<Trans>Trabajaron en su semana 12 · ~90 días</Trans>}
        />
      </section>

      <CohortSection
        key={`${hotelId}|${range.from}`}
        defaultWeek={isPresent ? addWeeks(currentWeek, -1) : range.from}
        presence={presence}
        currentWeek={currentWeek}
        workers={workersById}
        sizes={sizes}
      />

      {/* Retención por cohorte. */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-ink">
            <Trans>Retención por cohorte</Trans>
          </h3>
          <div
            role="radiogroup"
            aria-label={t`Agrupar por`}
            className="inline-flex rounded-xl border border-line bg-surface p-1"
          >
            {(['week', 'month'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={granularity === option}
                onClick={() => {
                  setGranularity(option)
                }}
                className={cn(
                  'min-h-8 rounded-lg px-3 text-sm font-medium',
                  granularity === option ? 'bg-o-50 text-ink' : 'text-ink-3 hover:text-ink',
                )}
              >
                {option === 'week' ? t`Semanal` : t`Mensual`}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-ink-3">
          {granularity === 'week' ? (
            <Trans>
              Cada fila son quienes ingresaron esa semana; cada columna, qué parte trabajó k semanas
              después. La columna en curso todavía puede subir.
            </Trans>
          ) : (
            <Trans>
              Cada fila son quienes ingresaron ese mes; cada columna, qué parte trabajó k meses
              después. El mes en curso todavía puede subir.
            </Trans>
          )}
        </p>
        {retention.length === 0 ? (
          <p className="text-sm text-ink-3">
            <Trans>Todavía no hay ingresos que medir.</Trans>
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-ink-3">
                  <th className="sticky left-0 bg-surface px-3 py-2 text-left font-semibold">
                    <Trans>Ingreso</Trans>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <Trans>Personas</Trans>
                  </th>
                  {Array.from({ length: columns }, (_, k) => (
                    <th key={k} className="px-2 py-2 text-center font-semibold whitespace-nowrap">
                      {granularity === 'week' ? t`Sem ${k}` : t`Mes ${k}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {retention.map((row) => (
                  <tr key={row.cohort} className="border-b border-line last:border-0">
                    <td className="sticky left-0 bg-surface px-3 py-2 whitespace-nowrap text-ink">
                      {granularity === 'week' ? weekRangeOf(row.cohort) : monthLabel(row.cohort)}
                    </td>
                    <td className="px-3 py-2 text-right text-ink tabular-nums">{row.size}</td>
                    {Array.from({ length: columns }, (_, k) => {
                      const cell = row.cells[k]
                      return (
                        <td key={k} className="px-1 py-1 text-center">
                          {cell ? (
                            <span
                              title={t`${cell.count} de ${row.size}`}
                              className={cn(
                                'block min-w-12 rounded-md px-1.5 py-1 text-xs tabular-nums text-ink',
                                cell.partial && 'italic outline-1 outline-line outline-dashed',
                              )}
                              style={{
                                backgroundColor: `color-mix(in srgb, var(--green) ${String(
                                  Math.round(cell.share * 45),
                                )}%, transparent)`,
                              }}
                            >
                              {formatPercent(cell.share)}
                            </span>
                          ) : null}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
