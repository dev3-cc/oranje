import { Trans, useLingui } from '@lingui/react/macro'
import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import type { ContractDetail } from '../types/contract.types'

import { Button } from '@/shared/components/Button'
import { ContractDocument } from '@/shared/components/ContractDocument'
import { Modal } from '@/shared/components/Modal'

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
    </>
  )
}
