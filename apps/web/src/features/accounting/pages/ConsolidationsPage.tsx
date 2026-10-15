import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@oranje/ui'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link } from 'react-router'

import { useGetConsolidationsQuery } from '../api/settlementApi'
import { money } from '../lib/settlementFormat'
import {
  CONSOLIDATION_STATUS_LABEL,
  CONSOLIDATION_STATUS_TOKEN,
  CONSOLIDATION_STATUSES,
  type ConsolidationStatus,
} from '../types/settlement.constants'

import personajeAyuda from '@/assets/ilustrations/personaje-ayuda.svg'
import personajePagado from '@/assets/ilustrations/personaje-pago-procesado.svg'
// La misma cinta de semanas del Timesheet de Contabilidad — una fila por
// semana es la misma forma, así que la misma pieza aplica igual (Hugo,
// 2026-10-08: "ya le metiste el UX a las demás secciones?").
// eslint-disable-next-line no-restricted-imports
import { WeekNavigator } from '@/features/timesheet/components/TimesheetViewControls'
// eslint-disable-next-line no-restricted-imports
import { WeekSlider } from '@/features/timesheet/components/WeekSlider'
// eslint-disable-next-line no-restricted-imports
import { resolveWeek } from '@/features/timesheet/lib/weekNavigation'
import { FilterReset } from '@/shared/components/FilterReset'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { LoadError } from '@/shared/components/LoadError'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { ReloadButton } from '@/shared/components/ReloadButton'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatWeekRange } from '@/shared/lib/formatters'

const ANY = 'ALL'

/** El texto se traduce al pintar con `i18n._()` (D-36), como el resto de los intros. */
const INTRO_SLIDES: readonly {
  image: string
  title: MessageDescriptor
  text: MessageDescriptor
}[] = [
  {
    image: personajeAyuda,
    title: msg`Uno por colaborador, hotel y semana`,
    text: msg`Quien trabaja en dos hoteles la misma semana tiene dos consolidados — cada uno con su propio cheque.`,
  },
  {
    image: personajeAyuda,
    title: msg`Doble firma, en orden`,
    text: msg`Borrador → la Contadora lo valida contra los Timesheets aprobados → el Manager de Contabilidad autoriza (segunda firma) → se registra el pago.`,
  },
  {
    image: personajePagado,
    title: msg`Nace de la corrida de pago`,
    text: msg`Se genera solo al correr el pago de la semana (miércoles o la emergencia del jueves) — nunca se crea uno a mano aquí.`,
  },
] as const

/**
 * Consolidado Semanal: lo que se le paga a cada colaborador por semana. Es el
 * registro de Contabilidad; el hotel y el colaborador no lo ven aquí.
 */
export function ConsolidationsPage(): ReactNode {
  const { t, i18n } = useLingui()
  const [weekStart, setWeekStart] = useState('')
  const [status, setStatus] = useState<string>(ANY)
  const { isIntroOpen, dismissIntro, reopenIntro } = useIntroSeen('consolidados')

  /* Sin `weekStart`: se trae todo lo que el alcance permite y la semana se
     navega del lado del cliente (mismo patrón que el Timesheet, D-28). */
  const { data, isLoading, isFetching, isError, refetch } = useGetConsolidationsQuery({
    ...(status !== ANY ? { status } : {}),
  })

  const allRows = data ?? []
  const availableWeeks = [...new Set(allRows.map((row) => row.weekStart))].sort()
  const selectedWeek = resolveWeek(availableWeeks, weekStart)
  const rows = selectedWeek ? allRows.filter((row) => row.weekStart === selectedWeek) : []
  const activeFilters = status !== ANY ? 1 : 0

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              <Trans>Consolidado Semanal</Trans>
            </h1>
            {selectedWeek && (
              <p className="text-base text-ink-3">
                <Trans>
                  Semana {formatWeekRange(selectedWeek, rows[0]?.weekEnd ?? selectedWeek)}
                </Trans>
              </p>
            )}
          </div>
          <p className="mt-1.5 text-sm text-ink-3">
            <Trans>
              Lo que se le paga a cada colaborador por semana. Se revisa, se autoriza y se paga en
              ese orden.
            </Trans>
            {IS_DEV_UI && (
              <code className="ml-1.5 text-xs text-ink-4">settlement.consolidation</code>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ReloadButton
            onReload={() => {
              void refetch()
            }}
            isReloading={isFetching}
          />
          <button
            type="button"
            onClick={reopenIntro}
            className="cursor-pointer rounded-md px-2 py-1 text-xs font-semibold whitespace-nowrap text-o-700 hover:bg-o-50"
          >
            <Trans>¿Cómo funciona?</Trans>
          </button>
        </div>
      </header>

      <Modal
        isOpen={isIntroOpen}
        onClose={dismissIntro}
        title={t`Cómo funciona el Consolidado Semanal`}
        chromeless
      >
        <OnboardingIntro
          slides={INTRO_SLIDES.map((slide) => ({
            image: slide.image,
            title: i18n._(slide.title),
            text: i18n._(slide.text),
          }))}
          startLabel={t`Entendido`}
          onDone={dismissIntro}
        />
      </Modal>

      {availableWeeks.length > 0 && (
        <WeekNavigator
          weekStart={selectedWeek ?? availableWeeks[0] ?? ''}
          availableWeeks={availableWeeks}
          onSelect={setWeekStart}
        />
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <FilterSelect
          label={t`Estado`}
          anyLabel={t`Todos`}
          value={status}
          anyValue={ANY}
          options={CONSOLIDATION_STATUSES.map((code) => ({
            value: code,
            label: CONSOLIDATION_STATUS_LABEL[code],
          }))}
          onChange={setStatus}
          icon="flag"
        />
        <FilterReset
          activeCount={activeFilters}
          onReset={() => {
            setStatus(ANY)
          }}
        />
      </div>

      <p className="rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-ink-3">
        <Trans>
          Un consolidado es de un colaborador, un hotel y una semana: quien trabajó en dos hoteles
          aparece dos veces. El filtro por hotel llega después.
        </Trans>
      </p>

      {isError && (
        <LoadError
          message={t`No se pudieron cargar los consolidados. Reintenta en unos segundos.`}
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading && !data ? (
        <TableSkeleton rows={6} columns={7} />
      ) : (
        <WeekSlider
          weekStart={selectedWeek ?? ''}
          availableWeeks={availableWeeks}
          stepWidth={700}
          allowTouchDrag={false}
          onNavigate={setWeekStart}
        >
          <div className="rounded-lg border border-line bg-surface">
            <Table className="min-w-[48rem] text-left">
              <TableHeader>
                <TableRow className="border-line">
                  {[
                    t`Colaborador`,
                    t`Hotel`,
                    t`Semana`,
                    t`Bruto`,
                    t`Deducciones`,
                    t`Neto`,
                    t`Estado`,
                  ].map((header) => (
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
                    <TableCell colSpan={7} className="px-4 py-8 text-center text-sm text-ink-3">
                      {activeFilters > 0
                        ? t`No hay consolidados con esos filtros.`
                        : t`Todavía no hay consolidados. Se generan al cerrar la semana con las horas ya aprobadas.`}
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((row) => {
                  const code = row.status as ConsolidationStatus
                  return (
                    <TableRow key={row.id} className="border-line">
                      <TableCell className="px-4 py-3 text-sm font-semibold text-ink">
                        <Link
                          to={`/accounting/consolidations/${row.id}`}
                          className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-o-500"
                        >
                          {row.worker.fullName}
                        </Link>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-ink-2">
                        {/* row.hotel llega siempre del back (JOIN interno
                            contra commercial.hotel) — este guard es solo
                            para no tronar la pantalla entera si algún día
                            no fuera así (Hugo, 2026-10-15: "sigue
                            fallando"), mismo patrón que ya usa este mismo
                            archivo línea 99 y el Timesheet en settlementApi. */}
                        {row.hotel?.name ?? '—'}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-ink-3">
                        {formatWeekRange(row.weekStart, row.weekEnd)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-ink-2">
                        {money(row.grossAmount)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-ink-2">
                        {money(row.deductionAmount)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm font-semibold text-ink">
                        {money(row.netAmount)}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <StatusLightSoftBadge
                          token={CONSOLIDATION_STATUS_TOKEN[code] ?? 'st-gris'}
                          label={CONSOLIDATION_STATUS_LABEL[code] ?? row.status}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </WeekSlider>
      )}
    </div>
  )
}
