import { Trans, useLingui } from '@lingui/react/macro'
import { toast } from '@oranje/ui'
import type { ReactNode } from 'react'
import { useParams } from 'react-router'

import {
  useApproveInvoiceMutation,
  useGetInvoiceQuery,
  useMarkInvoiceSentMutation,
  usePayInvoiceMutation,
} from '../api/settlementApi'
import { hoursOf, money } from '../lib/settlementFormat'
import {
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TOKEN,
  type InvoiceStatus,
} from '../types/settlement.constants'

import { Button } from '@/shared/components/Button'
import { DetailSkeleton } from '@/shared/components/DetailSkeleton'
import { LoadError } from '@/shared/components/LoadError'
import { MetricCard } from '@/shared/components/MetricCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatDate, formatWeekRange } from '@/shared/lib/formatters'

/**
 * Detalle de una factura al hotel. Cada acción aparece solo si el permiso la
 * autoriza y el estado la admite (aprobar → enviar → cobrar). El borrador lo
 * ven la Contadora y el Manager; quien no puede aprobarlo ve que está pendiente.
 */
export function InvoiceDetailPage(): ReactNode {
  const { t } = useLingui()
  const { invoiceId = '' } = useParams()
  const can = useCan()

  const {
    data: row,
    isLoading,
    isError,
    refetch,
  } = useGetInvoiceQuery(invoiceId, {
    skip: invoiceId === '',
  })
  const [approve, approveState] = useApproveInvoiceMutation()
  const [markSent, sentState] = useMarkInvoiceSentMutation()
  const [pay, payState] = usePayInvoiceMutation()

  const busy = approveState.isLoading || sentState.isLoading || payState.isLoading

  if (isLoading && !row) return <DetailSkeleton />

  if (isError || !row) {
    return (
      <LoadError
        message={t`No se pudo abrir esta factura. Puede que ya no exista.`}
        onRetry={() => {
          void refetch()
        }}
      />
    )
  }

  const status = row.status as InvoiceStatus
  const canAuthorize = can('payroll:authorize')
  const canCollect = can('payroll:mark_paid')
  const canApprove = status === 'DRAFT' && canAuthorize
  const canSend = status === 'APPROVED' && canAuthorize
  const canPay = status === 'SENT' && canCollect

  const nextOwner: Record<InvoiceStatus, string> = {
    DRAFT: t`La aprueba el Manager de Contabilidad, validando bill rate y horas autorizadas.`,
    APPROVED: t`Aprobada. Falta registrar el envío al hotel.`,
    SENT: t`Emitida al hotel. Falta registrar el cobro.`,
    PAID: t`Pagada. Estado terminal.`,
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
          <h1 className="text-3xl font-bold tracking-tight text-ink">{row.folio}</h1>
          <p className="mt-1.5 text-sm text-ink-3">
            {row.hotel.name} · {formatWeekRange(row.periodStart, row.periodEnd)}
          </p>
        </div>
        <StatusLightSoftBadge
          token={INVOICE_STATUS_TOKEN[status] ?? 'st-gris'}
          label={INVOICE_STATUS_LABEL[status] ?? row.status}
        />
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <MetricCard value={money(row.totalAmount)} label={t`Total`} foot={t`a bill rate`} />
        <MetricCard
          value={money(row.creditAmount)}
          label={t`Crédito aplicado`}
          foot={t`notas de crédito`}
        />
        <MetricCard
          value={row.approvedAt ? formatDate(row.approvedAt) : '—'}
          label={t`Aprobada`}
          foot={row.approvedAt ? t`ya aprobada` : t`pendiente de aprobación`}
        />
      </div>

      {(status === 'DRAFT' || canApprove || canSend || canPay) && (
        <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-ink-2">{nextOwner[status]}</p>
          <div className="flex flex-wrap gap-2">
            {canApprove && (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() =>
                  run(
                    () => approve(row.id).unwrap(),
                    t`Factura aprobada`,
                    t`No se pudo aprobar la factura. Reintenta.`,
                  )
                }
              >
                <Trans>Aprobar factura</Trans>
              </Button>
            )}
            {canSend && (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() =>
                  run(
                    () => markSent(row.id).unwrap(),
                    t`Envío registrado`,
                    t`No se pudo registrar el envío. Reintenta.`,
                  )
                }
              >
                <Trans>Registrar envío al hotel</Trans>
              </Button>
            )}
            {canPay && (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() =>
                  run(
                    () => pay(row.id).unwrap(),
                    t`Cobro registrado`,
                    t`No se pudo registrar el cobro. Reintenta.`,
                  )
                }
              >
                <Trans>Registrar cobro</Trans>
              </Button>
            )}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">
          <Trans>Líneas facturadas</Trans>
        </h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-line text-xs tracking-wide text-ink-3 uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <Trans>Colaborador</Trans>
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <Trans>Posición</Trans>
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <Trans>Horas</Trans>
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <Trans>Bill rate</Trans>
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
                  <td className="px-4 py-3 font-medium text-ink">{line.workerName}</td>
                  <td className="px-4 py-3 text-ink-2">{line.positionName}</td>
                  <td className="px-4 py-3 text-ink-2">
                    {hoursOf(line.regularMinutes)}
                    {line.overtimeMinutes > 0 && (
                      <span className="ml-1.5 text-xs text-ink-3">
                        + {hoursOf(line.overtimeMinutes)} <Trans>extra</Trans>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-2">{money(line.billRateApplied)}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{money(line.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
