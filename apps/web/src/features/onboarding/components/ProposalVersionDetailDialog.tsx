import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import type { ProposalVersionSummary } from '../types/proposal.types'

import { ContractPreviewDialog } from './ContractPreviewDialog'

import { Button } from '@/shared/components/Button'
import { FormField } from '@/shared/components/FormField'
import { Modal } from '@/shared/components/Modal'
import { ProposalDocument } from '@/shared/components/ProposalDocument'
import { formatMoney } from '@/shared/lib/formatters'
import { preparedDateUs } from '@/shared/lib/proposalDocument'

/** Mismo input que el formulario vivo, pero apagado: ya no se puede tocar. */
const FROZEN_CONTROL_CLASS =
  'w-full cursor-not-allowed rounded-md border border-line bg-surface-2 px-4 py-3 text-sm text-ink-2 opacity-70'

/**
 * Lo que se abre al tocar CUALQUIER versión enviada del historial —toda la
 * tarjeta, no solo el ícono del PDF (Hugo, 2026-10-19: "al dar click al
 * contenedor completo"). Es la MISMA forma que el editor vivo (los mismos
 * campos, en el mismo orden), pero apagada: son los valores de ESA versión,
 * ya congelados, no el borrador actual. "Propuesta enviada" + "Contrato
 * enviado" van juntos arriba porque los dos documentos nacen de la misma
 * versión — el contrato es su espejo en el lenguaje legal.
 */
export function ProposalVersionDetailDialog({
  isOpen,
  onClose,
  hotelName,
  hotelAddress = null,
  contactEmail = null,
  version,
}: {
  isOpen: boolean
  onClose: () => void
  hotelName: string
  hotelAddress?: string | null
  contactEmail?: string | null
  version: ProposalVersionSummary
}): ReactNode {
  const { t } = useLingui()
  const [isContractOpen, setContractOpen] = useState(false)
  const senderName = version.byName || t`Oranje`

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t`Propuesta v${version.version}`}
        className="max-w-5xl"
      >
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface-2 p-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <MaterialIcon name="lock" className="text-base text-ink-3" aria-hidden />
            <Trans>Propuesta enviada</Trans>
          </span>
          <span className="text-ink-4" aria-hidden>
            ·
          </span>
          <button
            type="button"
            onClick={() => {
              setContractOpen(true)
            }}
            className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-o-700 hover:underline"
          >
            <MaterialIcon name="description" className="text-base" aria-hidden />
            <Trans>Contrato enviado</Trans>
          </button>
        </div>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <FormField label={t`Nombre de la propiedad`}>
              <input
                type="text"
                disabled
                value={version.propertyName || hotelName}
                className={FROZEN_CONTROL_CLASS}
              />
            </FormField>

            <FormField label={t`Fecha de preparación`}>
              <input
                type="text"
                disabled
                value={version.preparedDate || preparedDateUs()}
                className={FROZEN_CONTROL_CLASS}
              />
            </FormField>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FormField label={t`Marca / Administradora`}>
                <input
                  type="text"
                  disabled
                  value={version.brandManagementCompany || t`Sin dato`}
                  className={FROZEN_CONTROL_CLASS}
                />
              </FormField>
              <FormField label={t`Ciudad y estado`}>
                <input
                  type="text"
                  disabled
                  value={version.cityState || t`Sin dato`}
                  className={FROZEN_CONTROL_CLASS}
                />
              </FormField>
            </div>

            <FormField label={t`Dirigida a`}>
              <input
                type="text"
                disabled
                value={version.contactName || t`Sin dato`}
                className={FROZEN_CONTROL_CLASS}
              />
            </FormField>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FormField label={t`Teléfono de quien envía`}>
                <input
                  type="text"
                  disabled
                  value={version.senderPhone || t`Sin dato`}
                  className={FROZEN_CONTROL_CLASS}
                />
              </FormField>
              <FormField label={t`Correo de quien envía`}>
                <input
                  type="text"
                  disabled
                  value={version.senderEmail || t`Sin dato`}
                  className={FROZEN_CONTROL_CLASS}
                />
              </FormField>
            </div>

            <FormField label={t`Puestos cotizados`}>
              <ul className="flex flex-col divide-y divide-line rounded-md border border-line opacity-70">
                {version.rates.map((rate) => (
                  <li
                    key={rate.positionId}
                    className="flex items-center justify-between gap-3 p-3 text-sm"
                  >
                    <span className="text-ink-2">{rate.positionName}</span>
                    <span className="font-medium text-ink">
                      {formatMoney(rate.billRate)} <span className="text-ink-3">bill</span>
                    </span>
                  </li>
                ))}
              </ul>
            </FormField>
          </div>

          <div className="rounded-md border border-line bg-surface px-6 py-6">
            <ProposalDocument
              hotelName={hotelName}
              senderName={senderName}
              propertyName={version.propertyName || null}
              preparedDate={version.preparedDate || null}
              brandManagementCompany={version.brandManagementCompany || null}
              cityState={version.cityState || null}
              contactName={version.contactName || null}
              senderPhone={version.senderPhone || null}
              senderEmail={version.senderEmail || null}
              rates={version.rates.map((rate) => ({
                key: rate.positionId,
                positionName: rate.positionName,
                billRate: rate.billRate,
              }))}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose}>
            <Trans>Cerrar</Trans>
          </Button>
        </div>
      </Modal>

      <ContractPreviewDialog
        isOpen={isContractOpen}
        onClose={() => {
          setContractOpen(false)
        }}
        hotelName={hotelName}
        hotelAddress={hotelAddress}
        contactEmail={contactEmail}
        senderName={senderName}
        version={version}
      />
    </>
  )
}
