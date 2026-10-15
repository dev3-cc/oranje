import type { MessageDescriptor } from '@lingui/core'
import { msg, plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { useState } from 'react'

import {
  useGetAccountingTimesheetTimelineQuery,
  useGetClientHotelOptionsQuery,
} from '../api/settlementApi'
import { AccountingTimesheetGrid } from '../components/AccountingTimesheetGrid'
import { PayOverrideDialog, type PayOverrideTarget } from '../components/PayOverrideDialog'
import { hoursOf } from '../lib/settlementFormat'

import personajeCronograma from '@/assets/ilustrations/personaje-cronograma.svg'
// El carrusel de semanas es del Timesheet del staff — la misma pieza que
// Contabilidad pedía «ver más interactivo» (D-28, cambio mínimo: reusar, no
// reinventar la física de arrastre). La cinta de días es propia
// (`AccountingTimesheetGrid`); `WeekSlider` no se toca.
// eslint-disable-next-line no-restricted-imports
import { WeekSlider } from '@/features/timesheet/components/WeekSlider'
// eslint-disable-next-line no-restricted-imports
import { resolveWeek } from '@/features/timesheet/lib/weekNavigation'
import { FilterReset } from '@/shared/components/FilterReset'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { LoadError } from '@/shared/components/LoadError'
import { MetricCard } from '@/shared/components/MetricCard'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { ReloadButton } from '@/shared/components/ReloadButton'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { DEFAULT_COLUMN_WIDTH, TIMESHEET_WEEK_STATUSES } from '@/shared/constants/timesheetStatus'
import { TIMESHEET_WEEK_STATUS_LABEL } from '@/shared/constants/timesheetStatus'
import { useCan } from '@/shared/hooks/useCan'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { formatMoney, formatWeekRange } from '@/shared/lib/formatters'

const ANY = 'ALL'

/** El texto se traduce al pintar con `i18n._()` (D-36), como el resto de los intros. */
const INTRO_SLIDES: readonly {
  image: string
  title: MessageDescriptor
  text: MessageDescriptor
}[] = [
  {
    image: personajeCronograma,
    title: msg`Todas las semanas, de un vistazo`,
    text: msg`Arrastra la cinta o usa ‹ › para moverte entre semanas, como en el Timesheet del hotel. Cada día es de una persona y una requisición.`,
  },
  {
    image: personajeCronograma,
    title: msg`El pago estimado es en vivo`,
    text: msg`Se parte en 40 h regulares y lo que exceda, por requisición. Sin contrato ni tarifa interna que resolver, no se inventa un número — queda en «—».`,
  },
  {
    image: personajeCronograma,
    title: msg`Lo que corrijas, se paga`,
    text: msg`Tarifa y reparto de horas se pueden corregir aquí; el monto se recalcula solo. La corrida real del miércoles usa tu corrección, no lo calculado.`,
  },
]

/**
 * El Timesheet de todos los hoteles. Solo lectura de las horas; la vista
 * previa de pago (40 h por requisición, D-10) es un cálculo en vivo para que
 * Contabilidad lo revise ANTES de la corrida del miércoles, y quien tiene
 * `payroll:generate` puede corregir tarifa y reparto de horas (Hugo,
 * 2026-10-08) — la corrida real usa la corrección, no lo calculado.
 * Requiere `timesheet:read_all_hotels`: sin él no se consulta nada.
 */
export function AccountingTimesheetPage(): ReactNode {
  const { t, i18n } = useLingui()
  const can = useCan()
  const canReadAll = can('timesheet:read_all_hotels')
  const canOverride = can('payroll:generate')
  const [status, setStatus] = useState<string>(ANY)
  const [weekStart, setWeekStart] = useState('')
  const [hotelName, setHotelName] = useState<string>(ANY)
  const [editing, setEditing] = useState<PayOverrideTarget | null>(null)
  const { isIntroOpen, dismissIntro, reopenIntro } = useIntroSeen('timesheet-contabilidad')

  const { data: hotels } = useGetClientHotelOptionsQuery(undefined, { skip: !canReadAll })
  const { data, isLoading, isFetching, isError, refetch } = useGetAccountingTimesheetTimelineQuery(
    { ...(status !== ANY ? { status } : {}) },
    { skip: !canReadAll },
  )

  if (!canReadAll) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          <Trans>Timesheet · Todos los hoteles</Trans>
        </h1>
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
          <Trans>Tu rol todavía no tiene acceso a las horas de todos los hoteles.</Trans>
        </p>
      </div>
    )
  }

  const timeline = data ?? { days: [], rows: [], availableWeeks: [] }
  const selectedWeek = resolveWeek(timeline.availableWeeks, weekStart)
  const rows =
    hotelName === ANY ? timeline.rows : timeline.rows.filter((row) => row.hotelName === hotelName)
  const visibleTimeline = { ...timeline, rows }
  const activeFilters = (status !== ANY ? 1 : 0) + (hotelName !== ANY ? 1 : 0)

  const thisWeekRows = selectedWeek ? rows.filter((row) => row.byWeek[selectedWeek]) : []
  const overtimeMinutes = thisWeekRows.reduce(
    (sum, row) => sum + (row.byWeek[selectedWeek ?? '']?.overtimeMinutes ?? 0),
    0,
  )
  const estimatedTotal = thisWeekRows.reduce(
    (sum, row) => sum + Number(row.byWeek[selectedWeek ?? '']?.subtotal ?? 0),
    0,
  )
  const unresolvedCount = thisWeekRows.filter(
    (row) => row.byWeek[selectedWeek ?? '']?.subtotal == null,
  ).length

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              <Trans>Timesheet · Todos los hoteles</Trans>
            </h1>
            {selectedWeek && (
              <p className="text-base text-ink-3">
                <Trans>
                  Semana{' '}
                  {formatWeekRange(
                    selectedWeek,
                    new Date(new Date(`${selectedWeek}T00:00:00Z`).getTime() + 6 * 86_400_000)
                      .toISOString()
                      .slice(0, 10),
                  )}
                </Trans>
              </p>
            )}
          </div>
          <p className="mt-1.5 text-sm text-ink-3">
            <Trans>Solo lectura. Las horas se revisan en cada hotel; aquí solo se consultan.</Trans>
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
        title={t`Cómo funciona el Timesheet de todos los hoteles`}
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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <MetricCard
          value={String(thisWeekRows.length)}
          label={t`Hojas esta semana`}
          foot={t`colaborador × requisición`}
          icon="description"
        />
        <MetricCard
          value={hoursOf(overtimeMinutes)}
          label={t`Horas extra`}
          foot={t`de todos los hoteles, esta semana`}
          icon="schedule"
          tone={overtimeMinutes > 0 ? 'danger' : 'brand'}
        />
        <MetricCard
          value={formatMoney(estimatedTotal)}
          label={t`Pago estimado`}
          foot={
            unresolvedCount > 0
              ? t`${plural(unresolvedCount, { one: '# hoja sin tarifa, no incluida', other: '# hojas sin tarifa, no incluidas' })}`
              : t`con la tarifa y el multiplicador vigentes`
          }
          icon="payments"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <FilterSelect
          label={t`Hotel`}
          anyLabel={t`Todos`}
          value={hotelName}
          anyValue={ANY}
          options={(hotels ?? []).map((hotel) => ({ value: hotel.name, label: hotel.name }))}
          onChange={setHotelName}
          icon="apartment"
        />
        <FilterSelect
          label={t`Estado de la semana`}
          anyLabel={t`Todas`}
          value={status}
          anyValue={ANY}
          options={TIMESHEET_WEEK_STATUSES.map((code) => ({
            value: code,
            label: TIMESHEET_WEEK_STATUS_LABEL[code],
          }))}
          onChange={setStatus}
          icon="flag"
        />
        <FilterReset
          activeCount={activeFilters}
          onReset={() => {
            setStatus(ANY)
            setHotelName(ANY)
          }}
        />
      </div>

      <p className="rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-ink-3">
        {canOverride ? (
          <Trans>
            «Pago estimado» es un cálculo en vivo, no lo que ya se le pagó: parte las 40 h semanales
            por requisición y paga el resto al multiplicador de horas extra del hotel. Sin contrato
            ni tarifa interna que resolver, no se inventa un número — queda en «—». Lo que corrijas
            aquí es lo que paga la corrida real, no solo esta pantalla.
          </Trans>
        ) : (
          <Trans>
            «Pago estimado» es un cálculo en vivo, no lo que ya se le pagó: parte las 40 h semanales
            por requisición y paga el resto al multiplicador de horas extra del hotel. Sin contrato
            ni tarifa interna que resolver, no se inventa un número — queda en «—».
          </Trans>
        )}
      </p>

      {isError && (
        <LoadError
          message={t`No se pudo cargar el Timesheet. Reintenta en unos segundos.`}
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading && !data ? (
        <TableSkeleton rows={6} columns={8} />
      ) : (
        <WeekSlider
          weekStart={selectedWeek ?? ''}
          availableWeeks={timeline.availableWeeks}
          stepWidth={7 * DEFAULT_COLUMN_WIDTH}
          totalDays={timeline.days.length}
          continuous
          allowTouchDrag={false}
          onNavigate={setWeekStart}
        >
          <AccountingTimesheetGrid
            timeline={visibleTimeline}
            selectedWeek={selectedWeek ?? ''}
            columnWidth={DEFAULT_COLUMN_WIDTH}
            canOverride={canOverride}
            onCorrect={setEditing}
          />
        </WeekSlider>
      )}

      <PayOverrideDialog
        key={editing?.timesheetId}
        target={editing}
        onClose={() => {
          setEditing(null)
        }}
      />
    </div>
  )
}
