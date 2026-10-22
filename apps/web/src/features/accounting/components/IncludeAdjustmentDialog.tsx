import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'

import personajePagado from '@/assets/ilustrations/personaje-pago-procesado.svg'
import type { PayAdjustment } from '@/features/recruitment'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { formatMoney } from '@/shared/lib/formatters'

/** Quién pagó decide qué le pasa al pago del colaborador (Hugo, 2026-10-09):
    el ajuste de tarifa llano no tiene `settlementEffect`, así que es su
    propio caso — no hay de quién reembolsar o descontar, solo pisa la tarifa. */
function effectCopy(effect: string | null): { lead: MessageDescriptor; detail: MessageDescriptor } {
  switch (effect) {
    case 'REIMBURSE':
      return {
        lead: msg`se le suma al colaborador`,
        detail: msg`Lo pagó de su bolsillo: el monto se suma a lo que recibe esta semana, junto a sus horas.`,
      }
    case 'PAYROLL_DEDUCTION':
      return {
        lead: msg`se le resta al colaborador`,
        detail: msg`Oranje ya lo cubrió y el colaborador pidió que se le descontara: el monto se resta de lo que recibe esta semana, como una deducción más.`,
      }
    case 'COMPANY_EXPENSE':
      return {
        lead: msg`queda como gasto de Oranje, sin tocar su pago`,
        detail: msg`Lo pagó Oranje directo: queda registrado, pero no cambia lo que recibe esta semana.`,
      }
    default:
      return {
        lead: msg`ajusta la tarifa de su posición`,
        detail: msg`Esta asignación paga esto en vez de la tarifa del contrato, desde ahora.`,
      }
  }
}

/**
 * Que el Manager de QA apruebe el ajuste o el gasto de una eventual no lo mete
 * a la nómina: Contabilidad decide aparte, viendo antes qué va a pasar con
 * el pago del colaborador (Hugo, 2026-10-09). Mismo patrón que «Activar el
 * contrato» — un diálogo que enseña la consecuencia, no un doble toque mudo.
 */
export function IncludeAdjustmentDialog({
  isOpen,
  onClose,
  onConfirm,
  isIncluding,
  target,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isIncluding: boolean
  target: PayAdjustment | null
}): ReactNode {
  const { t, i18n } = useLingui()

  if (!target) return null

  const effect = effectCopy(target.settlementEffect)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t`Incluir en la nómina`}
      description={`${target.worker.fullName} · ${target.hotelName}`}
      className="max-w-lg"
      footer={
        <>
          <Button onClick={onClose} disabled={isIncluding}>
            <Trans>Todavía no</Trans>
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={isIncluding}>
            {isIncluding ? <Trans>Incluyendo…</Trans> : <Trans>Sí, inclúyelo</Trans>}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-4 rounded-lg bg-o-50 p-4">
          <img src={personajePagado} alt="" aria-hidden className="h-20 w-auto shrink-0" />
          <p className="text-sm leading-relaxed text-ink-2">
            <Trans>
              Al incluirlo, <span className="font-semibold text-ink">{i18n._(effect.lead)}</span>:
              entra en la próxima corrida de pago de esta semana, la que corres desde el
              Consolidado.
            </Trans>
          </p>
        </div>

        <dl className="flex flex-col divide-y divide-line rounded-lg border border-line">
          <div className="flex items-center justify-between gap-4 p-3">
            <dt className="text-sm text-ink-3">
              <Trans>Monto</Trans>
            </dt>
            <dd className="text-sm font-semibold text-ink">{formatMoney(Number(target.amount))}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 p-3">
            <dt className="text-sm text-ink-3">
              <Trans>Concepto</Trans>
            </dt>
            <dd className="text-sm font-semibold text-ink">
              {target.payConcept ? target.payConcept.name : t`Ajuste de tarifa`}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 p-3">
            <dt className="text-sm text-ink-3">
              <Trans>Pedido por</Trans>
            </dt>
            <dd className="text-sm font-semibold text-ink">{target.requestedBy.fullName}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 p-3">
            <dt className="text-sm text-ink-3">
              <Trans>Aprobado por</Trans>
            </dt>
            <dd className="text-sm font-semibold text-ink">{target.approvedBy?.fullName ?? '—'}</dd>
          </div>
        </dl>

        <p className="text-sm leading-relaxed text-ink-2">{i18n._(effect.detail)}</p>
      </div>
    </Modal>
  )
}
