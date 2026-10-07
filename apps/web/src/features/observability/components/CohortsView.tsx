import { Trans, useLingui } from '@lingui/react/macro'
import { cn, MaterialIcon } from '@oranje/ui'
import { type ReactNode, useState } from 'react'

import { share, weekRangeOf } from '../lib/cohortFormat'
import {
  addWeeks,
  buildPresence,
  cohortSizes,
  firstWeekOf,
  weeksOf,
  type Granularity,
  mondayOf,
  retentionAt,
  retentionTable,
  type Window,
} from '../lib/cohorts'

import { CohortSection, Stat } from './CohortSection'
import { CohortTimeline } from './CohortTimeline'
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
  /* La semana que se mira. Por defecto la pasada: la actual todavía no termina. */
  const [picked, setPicked] = useState(() => addWeeks(currentWeek, -1))
  const [isBand, setIsBand] = useState(false)

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
  /* La semana elegida no puede quedar antes de que el hotel empezara. */
  const start = firstWeek ?? currentWeek
  const selected = picked < start ? start : picked > currentWeek ? currentWeek : picked
  const timeline = cohortSizes(presence, { from: start, to: currentWeek }).reverse()

  /* La franja de 12 semanas alrededor de la elegida (5 antes, 6 después),
     recortada al historial: es lo que comparan la tabla y los totales. */
  let bandFrom = addWeeks(selected, -5)
  if (bandFrom < start) bandFrom = start
  let bandTo = addWeeks(bandFrom, WINDOW_WEEKS - 1)
  if (bandTo > currentWeek) {
    bandTo = currentWeek
    const shifted = addWeeks(bandTo, -(WINDOW_WEEKS - 1))
    bandFrom = shifted < start ? start : shifted
  }
  const range: Window = { from: bandFrom, to: bandTo }
  const bandWeeks = weeksOf(range)

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
      <details className="group rounded-xl border border-line bg-surface-2 px-4 py-2 text-sm text-ink-2">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-ink-2">
          <MaterialIcon name="help" className="text-lg text-ink-3" aria-hidden />
          <Trans>¿Cómo se calcula?</Trans>
          <MaterialIcon
            name="expand_more"
            className="ml-auto text-lg text-ink-3 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <p className="pt-2 pb-1">
          <Trans>
            «Ingresó» = su primera semana con ponches en todo su historial. «Trabajó» una semana =
            ponchó al menos una vez esa semana; no dice cuántos días. Lo que pasó con quien ya no
            trabaja sale de su estado actual en el Semáforo del Colaborador.
          </Trans>
        </p>
      </details>
      {truncated && <TruncatedNotice />}

      {/* Moverse en el tiempo: el hotel, los saltos rápidos y la línea de tiempo. */}
      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink-2">
            <MaterialIcon name="apartment" className="text-xl text-ink-3" aria-hidden />
            <select
              id="cohort-hotel"
              aria-label={t`Hotel`}
              value={hotelId}
              onChange={(event) => {
                setHotelId(event.target.value)
              }}
              className="min-h-10 max-w-full rounded-lg border border-line bg-surface px-2 text-sm font-normal text-ink"
            >
              <option value={ALL_HOTELS}>{t`Todos los hoteles`}</option>
              {hotels.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={selected === start}
              onClick={() => {
                setPicked(start)
              }}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-line px-3 text-sm font-medium text-ink-2 hover:bg-surface-2 disabled:opacity-40"
            >
              <MaterialIcon name="first_page" className="text-lg" aria-hidden />
              {hotel ? t`Cuando empezó a ponchar` : t`Inicio del historial`}
            </button>
            <button
              type="button"
              disabled={selected === addWeeks(currentWeek, -1)}
              onClick={() => {
                setPicked(addWeeks(currentWeek, -1))
              }}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-line px-3 text-sm font-medium text-ink-2 hover:bg-surface-2 disabled:opacity-40"
            >
              <MaterialIcon name="today" className="text-lg" aria-hidden />
              <Trans>Semana pasada</Trans>
            </button>
          </div>
        </div>

        {firstWeek === null ? (
          <p className="text-sm text-ink-3">
            <Trans>Todavía no hay ponches para este hotel.</Trans>
          </p>
        ) : (
          <>
            <CohortTimeline
              sizes={timeline}
              selected={selected}
              band={range}
              onSelect={setPicked}
            />
            <p className="text-xs text-ink-3">
              {hotel ? (
                <Trans>
                  Cada barra es una semana y su número, cuántas personas empezaron a ponchar en{' '}
                  {hotel.name} esa semana (desde {weekRangeOf(hotel.firstWeek)}). Toca una barra o
                  usa las flechas para moverte; lo sombreado son las 12 semanas que se comparan
                  abajo.
                </Trans>
              ) : (
                <Trans>
                  Cada barra es una semana y su número, cuántas personas empezaron a trabajar esa
                  semana. Toca una barra o usa las flechas para moverte; lo sombreado son las 12
                  semanas que se comparan abajo.
                </Trans>
              )}
            </p>
          </>
        )}
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
          hint={<Trans>Ingresos de las 12 semanas sombreadas</Trans>}
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
        presence={presence}
        currentWeek={currentWeek}
        workers={workersById}
        selected={selected}
        band={bandWeeks}
        isBand={isBand}
        onBandChange={setIsBand}
        hotelName={hotel?.name ?? null}
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
                  <tr
                    key={row.cohort}
                    className={cn(
                      'border-b border-line last:border-0',
                      granularity === 'week' && 'cursor-pointer hover:bg-surface-2',
                      row.cohort === (granularity === 'week' ? selected : selected.slice(0, 7)) &&
                        'bg-o-50',
                    )}
                    onClick={() => {
                      if (granularity === 'week') setPicked(row.cohort)
                    }}
                  >
                    <td
                      className={cn(
                        'sticky left-0 px-3 py-2 whitespace-nowrap text-ink',
                        row.cohort === (granularity === 'week' ? selected : selected.slice(0, 7))
                          ? 'bg-o-50 font-semibold'
                          : 'bg-surface',
                      )}
                    >
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
