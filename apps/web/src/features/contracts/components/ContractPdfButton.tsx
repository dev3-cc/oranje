import { Trans, useLingui } from '@lingui/react/macro'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  MaterialIcon,
  toast,
} from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { useMarkContractSentMutation, useSendContractEmailMutation } from '../api/contractsApi'
import type { ContractDetail } from '../types/contract.types'

import { BlockedAction } from '@/shared/components/BlockedAction'
import { Button } from '@/shared/components/Button'
import { ContractDocument } from '@/shared/components/ContractDocument'
import { Modal } from '@/shared/components/Modal'
import { SendDocumentModal } from '@/shared/components/SendDocumentModal'
import { apiErrorMessage } from '@/shared/lib/apiError'
import {
  contractPdfBlob,
  downloadContractDocx,
  downloadContractPdf,
} from '@/shared/lib/contractExport'

/**
 * El acuerdo de servicio del contrato firmado, listo para imprimir o guardar
 * como PDF.
 *
 * Es el MISMO documento que la vista previa de la propuesta, pero con los datos
 * del contrato: su vigencia real en vez de la fecha de hoy, sus tarifas (que
 * pueden no ser las que se propusieron, si hubo negociación) y sus recargos de
 * overtime y festivos.
 *
 * Como en la propuesta, el documento se pinta dos veces: dentro del modal para
 * verlo y portalizado a `#print-root` para imprimirlo completo — dentro del
 * modal queda encerrado en un contenedor con scroll y solo saldría el trozo
 * visible. Y sale sin firmas: se firma fuera del sistema.
 *
 * Enviar es como en la Propuesta (Hugo, 2026-10-23): «Enviar contrato» con
 * «Enviar por correo» o «Marcar como enviado», y cualquiera de los dos congela
 * el borrador. Ya enviado, solo queda reenviarlo por correo.
 */
export function ContractPdfButton({
  contract,
  canSend,
  sendBlockers = [],
}: {
  contract: ContractDetail
  /** `terms_and_conditions:update`: el mismo permiso que editarlo. */
  canSend: boolean
  /** Lo que impide enviarlo (hoy, no tener tarifas): apaga el botón y lo dice. */
  sendBlockers?: readonly string[]
}): ReactNode {
  const { t } = useLingui()
  const [isOpen, setIsOpen] = useState(false)
  const [isSendOpen, setSendOpen] = useState(false)
  const [isMarkOpen, setMarkOpen] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendContractEmail, { isLoading: isSendingEmail }] = useSendContractEmailMutation()
  const [markContractSent, { isLoading: isMarking }] = useMarkContractSentMutation()
  const isDraftUnsent = contract.status === 'DRAFT' && contract.sentAt === null
  const canResend = contract.status === 'ACTIVE' || contract.status === 'DRAFT'
  const printRoot = document.getElementById('print-root')

  const documentProps = {
    hotelName: contract.hotelName,
    propertyName: contract.propertyName,
    propertyAddress: contract.propertyAddress ?? contract.hotelAddress,
    companyEmail: contract.companyEmail,
    serviceProviderName: contract.serviceProviderName,
    serviceProviderEmail: contract.serviceProviderEmail,
    rates: contract.rates.map((rate) => ({
      key: rate.id,
      positionName: rate.positionName,
      billRate: rate.billRate,
    })),
    startDate: contract.validFrom,
    endDate: contract.validTo,
  }

  async function confirmSend({ to, note }: { to: string; note: string }): Promise<void> {
    try {
      const pdf = await contractPdfBlob(documentProps)
      const result = await sendContractEmail({ contractId: contract.id, to, note, pdf }).unwrap()
      setSendOpen(false)
      toast.success(
        result.status === 'SENT'
          ? t`Contrato enviado al hotel`
          : t`No se pudo mandar el correo — inténtalo de nuevo o mándalo tú aparte.`,
      )
    } catch (error) {
      setSendError(
        apiErrorMessage(error, {
          byCode: { CONTRACT_WITHOUT_RATES: t`Sin tarifas no se puede enviar el contrato.` },
          fallback: t`No se pudo mandar el correo.`,
        }),
      )
    }
  }

  async function confirmMark(): Promise<void> {
    try {
      await markContractSent({ contractId: contract.id }).unwrap()
      setMarkOpen(false)
      toast.success(t`Contrato marcado como enviado: quedó bloqueado`)
    } catch (error) {
      toast.error(
        apiErrorMessage(error, {
          byCode: {
            CONTRACT_ALREADY_SENT: t`Este contrato ya estaba marcado como enviado.`,
            CONTRACT_WITHOUT_RATES: t`Sin tarifas no se puede enviar el contrato.`,
          },
          fallback: t`No se pudo marcar como enviado. Reintenta en unos segundos.`,
        }),
      )
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setIsOpen(true)
        }}
      >
        <Trans>Ver PDF</Trans>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">
            <MaterialIcon name="download" className="text-base" aria-hidden />
            <Trans>Descargar</Trans>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              void downloadContractPdf(documentProps)
            }}
          >
            <MaterialIcon name="picture_as_pdf" className="text-base" aria-hidden />
            <Trans>Descargar PDF</Trans>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              void downloadContractDocx(documentProps)
            }}
          >
            <MaterialIcon name="description" className="text-base" aria-hidden />
            <Trans>Descargar Word</Trans>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {canSend && isDraftUnsent && (
        <DropdownMenu>
          <BlockedAction reasons={sendBlockers} title={t`Antes de enviar:`}>
            <DropdownMenuTrigger asChild>
              <Button variant="primary" disabled={sendBlockers.length > 0}>
                <Trans>Enviar contrato</Trans>
                <MaterialIcon name="expand_more" className="text-base" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
          </BlockedAction>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                setSendError(null)
                setSendOpen(true)
              }}
            >
              <MaterialIcon name="mail" className="text-base" aria-hidden />
              <Trans>Enviar por correo</Trans>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setMarkOpen(true)
              }}
            >
              <MaterialIcon name="task_alt" className="text-base" aria-hidden />
              <Trans>Marcar como enviado</Trans>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {canSend && !isDraftUnsent && canResend && (
        <BlockedAction reasons={sendBlockers} title={t`Antes de enviar:`}>
          <Button
            disabled={sendBlockers.length > 0}
            onClick={() => {
              setSendError(null)
              setSendOpen(true)
            }}
          >
            <MaterialIcon name="mail" className="text-base" aria-hidden />
            <Trans>Reenviar por correo</Trans>
          </Button>
        </BlockedAction>
      )}

      <Modal
        isOpen={isMarkOpen}
        onClose={() => {
          setMarkOpen(false)
        }}
        title={t`¿Marcar el contrato como enviado?`}
        description={t`Úsalo si ya se lo hiciste llegar al hotel por fuera. Igual que la propuesta, al enviarlo queda bloqueado: si hay que corregir algo, el BDC lo desbloquea.`}
        footer={
          <>
            <Button
              disabled={isMarking}
              onClick={() => {
                setMarkOpen(false)
              }}
            >
              <Trans>Cancelar</Trans>
            </Button>
            <Button
              variant="primary"
              disabled={isMarking}
              onClick={() => {
                void confirmMark()
              }}
            >
              {isMarking ? <Trans>Marcando…</Trans> : <Trans>Sí, marcar como enviado</Trans>}
            </Button>
          </>
        }
      >
        {null}
      </Modal>

      <Modal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false)
        }}
        title={t`Contrato ${contract.number}`}
        description={t`${contract.hotelName}. Se firma fuera del sistema: el documento sale sin firmas.`}
        className="max-w-3xl"
        footer={
          <>
            <Button
              onClick={() => {
                setIsOpen(false)
              }}
            >
              <Trans>Cerrar</Trans>
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                window.print()
              }}
            >
              <Trans>Imprimir o guardar como PDF</Trans>
            </Button>
          </>
        }
      >
        <div className="rounded-md border border-line bg-surface px-8 py-7">
          <ContractDocument {...documentProps} />
        </div>

        {isOpen &&
          printRoot !== null &&
          createPortal(
            <div aria-hidden="true">
              <ContractDocument {...documentProps} />
            </div>,
            printRoot,
          )}
      </Modal>

      <SendDocumentModal
        isOpen={isSendOpen}
        onClose={() => {
          setSendOpen(false)
          setSendError(null)
        }}
        title={isDraftUnsent ? t`Enviar contrato por correo` : t`Reenviar contrato por correo`}
        isSending={isSendingEmail}
        error={sendError}
        onConfirm={(params) => {
          void confirmSend(params)
        }}
      />
    </>
  )
}
