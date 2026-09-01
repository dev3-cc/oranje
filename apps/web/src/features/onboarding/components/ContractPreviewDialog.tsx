import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

import type { ProposalVersionSummary } from '../types/proposal.types'

import { ContractDocument } from './ContractDocument'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'

/**
 * Vista previa del contrato de una versión de la propuesta.
 *
 * El documento se pinta dos veces: una dentro del modal, para verlo, y otra
 * portalizada a `#print-root`, para imprimirlo. La copia imprimible vive FUERA
 * de `#root` a propósito — dentro del modal quedaba encerrada en un contenedor
 * con `overflow-y: auto` y `max-height`, y al imprimir solo salía el trozo que
 * cabía en pantalla.
 *
 * No se genera el PDF con una librería: eso tocaría el `pnpm-lock.yaml` de la
 * raíz, fuera del alcance acordado. El diálogo de impresión del navegador ya
 * ofrece «Guardar como PDF» y produce el mismo archivo.
 */
export function ContractPreviewDialog({
  isOpen,
  onClose,
  hotelName,
  hotelAddress = null,
  version,
}: {
  isOpen: boolean
  onClose: () => void
  hotelName: string
  hotelAddress?: string | null
  version: ProposalVersionSummary
}): ReactNode {
  const printRoot = document.getElementById('print-root')

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Vista previa del contrato"
      description={`${hotelName} · Propuesta v${version.version}. Las tarifas se toman de esta versión.`}
      className="max-w-3xl"
      footer={
        <>
          <Button onClick={onClose}>Cerrar</Button>
          <Button
            variant="primary"
            onClick={() => {
              window.print()
            }}
          >
            Imprimir o guardar como PDF
          </Button>
        </>
      }
    >
      <div className="rounded-md border border-line bg-surface px-8 py-7">
        <ContractDocument hotelName={hotelName} hotelAddress={hotelAddress} version={version} />
      </div>

      {/*
        Copia imprimible. `aria-hidden` porque para un lector de pantalla el
        documento ya está arriba: esta es la misma información repetida.
      */}
      {printRoot !== null &&
        createPortal(
          <div aria-hidden="true">
            <ContractDocument hotelName={hotelName} hotelAddress={hotelAddress} version={version} />
          </div>,
          printRoot,
        )}
    </Modal>
  )
}
