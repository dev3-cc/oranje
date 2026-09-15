import { Trans, useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'

import type { ContractDetail } from '../types/contract.types'

import personajeAcceso from '@/assets/ilustrations/personaje-acceso-protegido.svg'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { formatDate, formatMoney } from '@/shared/lib/formatters'

/**
 * Activar un contrato es el acto que enciende el dinero de ese hotel: a partir
 * de ahí la nómina paga y la factura cobra con estas tarifas. Antes era un
 * doble toque en el botón, que no decía nada de eso — quien lo apretaba dos
 * veces no sabía qué estaba encendiendo.
 *
 * Ahora es un diálogo que enseña lo que va a quedar fijo y las dos
 * consecuencias que nadie adivina: que las tarifas dejan de editarse y que el
 * contrato anterior del hotel, si lo hay, queda vencido.
 */
export function ActivateContractDialog({
  isOpen,
  onClose,
  onConfirm,
  isActivating,
  contract,
  activeContractNumber,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isActivating: boolean
  contract: ContractDetail
  /** El contrato que hoy rige en ese hotel, si hay otro. */
  activeContractNumber: string | null
}): ReactNode {
  const { t } = useLingui()
  const cheapest =
    contract.rates.length > 0 ? Math.min(...contract.rates.map((rate) => rate.billRate)) : 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t`Activar el contrato`}
      description={`${contract.number} · ${contract.hotelName}`}
      className="max-w-lg"
      footer={
        <>
          <Button onClick={onClose} disabled={isActivating}>
            <Trans>Todavía no</Trans>
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={isActivating}>
            {isActivating ? <Trans>Activando…</Trans> : <Trans>Sí, activar contrato</Trans>}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-4 rounded-lg bg-o-50 p-4">
          <img src={personajeAcceso} alt="" aria-hidden className="h-20 w-auto shrink-0" />
          <p className="text-sm leading-relaxed text-ink-2">
            <Trans>
              Al activarlo, este hotel{' '}
              <span className="font-semibold text-ink">empieza a cobrar</span>: desde la fecha de
              vigencia, la nómina de su gente y la factura del hotel se calculan con estas tarifas.
            </Trans>
          </p>
        </div>

        <dl className="flex flex-col divide-y divide-line rounded-lg border border-line">
          <div className="flex items-center justify-between gap-4 p-3">
            <dt className="text-sm text-ink-3">
              <Trans>Rige desde</Trans>
            </dt>
            <dd className="text-sm font-semibold text-ink">{formatDate(contract.validFrom)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 p-3">
            <dt className="text-sm text-ink-3">
              <Trans>Puestos cotizados</Trans>
            </dt>
            <dd className="text-sm font-semibold text-ink">
              {contract.rates.length === 1
                ? t`1 puesto · ${formatMoney(cheapest)} el bill`
                : t`${String(contract.rates.length)} puestos · desde ${formatMoney(cheapest)}`}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 p-3">
            <dt className="text-sm text-ink-3">
              <Trans>Tiempo extra</Trans>
            </dt>
            <dd className="text-sm font-semibold text-ink">
              <Trans>{contract.multipliers.overtime.bill.toFixed(2)}× lo facturado</Trans>
            </dd>
          </div>
        </dl>

        <ul className="flex flex-col gap-2 text-sm leading-relaxed text-ink-2">
          <li>
            <Trans>
              <span className="font-semibold text-ink">Las tarifas dejan de editarse.</span> Para
              cambiarlas después hay que crear un contrato nuevo.
            </Trans>
          </li>
          {activeContractNumber !== null && (
            <li>
              <Trans>
                <span className="font-semibold text-ink">
                  El contrato {activeContractNumber} queda vencido.
                </span>{' '}
                Solo puede haber uno vigente por hotel.
              </Trans>
            </li>
          )}
          <li>
            <Trans>
              Las semanas ya aprobadas{' '}
              <span className="font-semibold text-ink">no se recalculan</span>: cada consolidado
              guarda lo que regía ese día.
            </Trans>
          </li>
        </ul>
      </div>
    </Modal>
  )
}
