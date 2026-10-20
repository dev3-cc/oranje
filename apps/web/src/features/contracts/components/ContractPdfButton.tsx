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

import { useSendContractEmailMutation } from '../api/contractsApi'
import type { ContractDetail } from '../types/contract.types'

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
 */
export function ContractPdfButton({ contract }: { contract: ContractDetail }): ReactNode {
  const { t } = useLingui()
  const [isOpen, setIsOpen] = useState(false)
  const [isSendOpen, setSendOpen] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendContractEmail, { isLoading: isSendingEmail }] = useSendContractEmailMutation()
  const printRoot = document.getElementById('print-root')

  const documentProps = {
    hotelName: contract.hotelName,
    hotelAddress: contract.hotelAddress,
    rates: contract.rates.map((rate) => ({
      key: rate.id,
      positionName: rate.positionName,
      payRate: rate.payRate,
      billRate: rate.billRate,
    })),
    startDate: contract.validFrom,
    endDate: contract.validTo,
    terms: {
      overtime: {
        pay: contract.multipliers.overtime.pay,
        bill: contract.multipliers.overtime.bill,
      },
      holiday: { pay: contract.multipliers.holiday.pay, bill: contract.multipliers.holiday.bill },
    },
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
      setSendError(apiErrorMessage(error, { fallback: t`No se pudo mandar el correo.` }))
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

      <Button
        onClick={() => {
          setSendError(null)
          setSendOpen(true)
        }}
      >
        <MaterialIcon name="mail" className="text-base" aria-hidden />
        <Trans>Enviar por correo</Trans>
      </Button>

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
        title={t`Enviar contrato por correo`}
        isSending={isSendingEmail}
        error={sendError}
        onConfirm={(params) => {
          void confirmSend(params)
        }}
      />
    </>
  )
}
