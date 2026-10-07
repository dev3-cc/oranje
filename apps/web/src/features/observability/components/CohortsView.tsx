import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@oranje/ui'
import { type ReactNode, useState } from 'react'

import {
  buildPresence,
  cohortSizes,
  type Granularity,
  mondayOf,
  retentionAt,
  retentionTable,
} from '../lib/cohorts'

import { CohortSection, share, Stat, weekRangeOf } from './CohortSection'
import { PeopleNotice } from './PeopleView'
import { TruncatedNotice } from './TabParts'

import { formatPercent } from '@/shared/lib/formatters'
import type { RequisitionApi, TimesheetApi, WorkerApi } from '@/shared/types/apiContract.types'

/** Cohortes que se pueden elegir y filas de la tabla de retención. */
const COHORT_WEEKS = 12
const COHORT_MONTHS = 6

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

  const hotelOf = new Map(
    requisitions.map((requisition) => [requisition.id, requisition.hotel.name]),
  )
  const presence = buildPresence(timesheets, hotelOf)
  const workersById = new Map(workers.map((worker) => [worker.id, worker]))
  const sizes = cohortSizes(presence, currentWeek, COHORT_WEEKS)

  const retention = retentionTable(
    presence,
    granularity,
    currentWeek,
    granularity === 'week' ? COHORT_WEEKS : COHORT_MONTHS,
  )
  const columns = Math.max(0, ...retention.map((row) => row.cells.length))
  const monthLabel = (month: string): string =>
    new Date(`${month}-01T00:00:00Z`).toLocaleDateString(i18n.locale, {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })

  const at1 = retentionAt(presence, 1, currentWeek, COHORT_WEEKS)
  const at4 = retentionAt(presence, 4, currentWeek, COHORT_WEEKS * 2)
  const at12 = retentionAt(presence, 12, currentWeek, COHORT_WEEKS * 3)

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
          hint={<Trans>Ingresos de las últimas 12 semanas</Trans>}
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
