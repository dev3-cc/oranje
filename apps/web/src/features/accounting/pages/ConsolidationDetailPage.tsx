import { Trans, useLingui } from '@lingui/react/macro'
import { toast } from '@oranje/ui'
import type { ReactNode } from 'react'
import { useParams } from 'react-router'

import {
  useAuthorizeConsolidationMutation,
  useGetConsolidationQuery,
  useValidateConsolidationMutation,
} from '../api/settlementApi'
import { PayConsolidationButton } from '../components/PayConsolidationButton'
import { hoursOf, money } from '../lib/settlementFormat'
import {
  CONSOLIDATION_STATUS_LABEL,
  CONSOLIDATION_STATUS_TOKEN,
  type ConsolidationStatus,
  deductionLabel,
} from '../types/settlement.constants'

import { Button } from '@/shared/components/Button'
import { DetailSkeleton } from '@/shared/components/DetailSkeleton'
import { LoadError } from '@/shared/components/LoadError'
import { MetricCard } from '@/shared/components/MetricCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatDateTime, formatWeekRange } from '@/shared/lib/formatters'

/**
 * Detalle de un Consolidado. Cada acción aparece solo si el permiso de quien
 * mira la autoriza Y el estado la admite; lo que no se puede hacer no se pinta.
 */
export function ConsolidationDetailPage(): ReactNode {
  const { t } = useLingui()
  const { consolidationId = '' } = useParams()
  const can = useCan()

  const {
    data: row,
    isLoading,
    isError,
    refetch,
  } = useGetConsolidationQuery(consolidationId, {
    skip: consolidationId === '',
  })
  const [validate, validateState] = useValidateConsolidationMutation()
  const [authorize, authorizeState] = useAuthorizeConsolidationMutation()

  const busy = validateState.isLoading || authorizeState.isLoading

  if (isLoading && !row) return <DetailSkeleton />

  if (isError || !row) {
    return (
      <LoadError
        message={t`No se pudo abrir este consolidado. Puede que ya no exista.`}
        onRetry={() => {
          void refetch()
        }}
      />
    )
  }

  const status = row.status as ConsolidationStatus
  const canValidate = status === 'DRAFT' && can('payroll:validate')
  const canAuthorize = status === 'VALIDATED' && can('payroll:authorize')
  const canPay = status === 'AUTHORIZED' && can('payroll:mark_paid')

  /* Quién sigue, sin botón: dice a quien mira de quién depende el avance. */
  const nextOwner: Record<ConsolidationStatus, string> = {
    DRAFT: t`Lo revisa la Contadora contra los Timesheets aprobados.`,
    VALIDATED: t`Lo autoriza el Manager de Contabilidad: segunda firma.`,
    AUTHORIZED: t`Lo registra el Manager de Contabilidad al pagar.`,
    PAID: t`Pagado. Estado terminal.`,
  }

  const run = (action: () => Promise<unknown>, success: string, fallback: string): void => {
    void action()
      .then(() => {
        toast.success(success)
      })
      .catch((error: unknown) => {
        toast.error(apiErrorMessage(error, { fallback }))
      })
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">{row.worker.fullName}</h1>
          <p className="mt-1.5 text-sm text-ink-3">{formatWeekRange(row.weekStart, row.weekEnd)}</p>
        </div>
        <StatusLightSoftBadge
          token={CONSOLIDATION_STATUS_TOKEN[status] ?? 'st-gris'}
          label={CONSOLIDATION_STATUS_LABEL[status] ?? row.status}
        />
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <MetricCard
          value={money(row.grossAmount)}
          label={t`Bruto`}
          foot={t`antes de deducciones`}
        />
        <MetricCard
          value={money(row.deductionAmount)}
          label={t`Deducciones`}
          foot={t`uniforme, comida y retención`}
        />
        <MetricCard value={money(row.netAmount)} label={t`Neto a pagar`} foot={t`lo que recibe`} />
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-ink-2">{nextOwner[status]}</p>
          <div className="flex flex-wrap gap-2">
            {canValidate && (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() =>
                  run(
                    () => validate(row.id).unwrap(),
                    t`Consolidado marcado como revisado`,
                    t`No se pudo marcar como revisado. Reintenta.`,
                  )
                }
              >
                <Trans>Marcar como revisado</Trans>
              </Button>
            )}
            {canAuthorize && (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() =>
                  run(
                    () => authorize(row.id).unwrap(),
                    t`Pago autorizado`,
                    t`No se pudo autorizar el pago. Reintenta.`,
                  )
                }
              >
                <Trans>Autorizar pago</Trans>
              </Button>
            )}
            {canPay && (
              <PayConsolidationButton
                consolidationId={row.id}
                workerName={row.worker.fullName}
                netAmount={row.netAmount}
              />
            )}
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-ink-3">
              <Trans>Revisado</Trans>
            </dt>
            <dd className="font-medium text-ink">
              {row.validatedAt ? formatDateTime(row.validatedAt) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-ink-3">
              <Trans>Autorizado</Trans>
            </dt>
            <dd className="font-medium text-ink">
              {row.authorizedAt ? formatDateTime(row.authorizedAt) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-ink-3">
              <Trans>Pagado</Trans>
            </dt>
            <dd className="font-medium text-ink">
              {row.paidAt ? formatDateTime(row.paidAt) : '—'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">
          <Trans>Líneas trabajadas</Trans>
        </h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-line text-xs tracking-wide text-ink-3 uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <Trans>Hotel</Trans>
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <Trans>Posición</Trans>
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <Trans>Horas</Trans>
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <Trans>Tarifa</Trans>
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <Trans>Subtotal</Trans>
                </th>
              </tr>
            </thead>
            <tbody>
              {(row.details ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-3">
                    <Trans>Sin líneas.</Trans>
                  </td>
                </tr>
              )}
              {(row.details ?? []).map((line) => (
                <tr key={line.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-ink">{line.hotelName}</td>
                  <td className="px-4 py-3 text-ink-2">{line.positionName}</td>
                  <td className="px-4 py-3 text-ink-2">
                    {hoursOf(line.regularMinutes)}
                    {line.overtimeMinutes > 0 && (
                      <span className="ml-1.5 text-xs text-ink-3">
                        + {hoursOf(line.overtimeMinutes)} <Trans>extra</Trans>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-2">
                    {money(line.payRateApplied)}
                    <span className="ml-1.5 text-xs text-ink-3">
                      {line.isInternalRate ? t`interna` : t`de contrato`}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-ink">{money(line.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">
          <Trans>Deducciones</Trans>
        </h2>
        {(row.deductions ?? []).length === 0 ? (
          <p className="text-sm text-ink-3">
            <Trans>Sin deducciones esta semana.</Trans>
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {(row.deductions ?? []).map((deduction) => (
              <li key={deduction.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-ink">
                  {deductionLabel(deduction.type, t`Otra deducción`)}
                  {deduction.sourceNote && (
                    <span className="ml-2 text-xs text-ink-3">{deduction.sourceNote}</span>
                  )}
                </span>
                <span className="text-sm font-semibold text-ink">{money(deduction.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {busy && (
        <span className="sr-only" aria-live="polite">
          <Trans>Guardando…</Trans>
        </span>
      )}
    </div>
  )
}
