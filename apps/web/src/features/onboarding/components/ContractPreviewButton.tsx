import { useState, type ReactNode } from 'react'

import type { ProposalVersionSummary } from '../types/proposal.types'

import { ContractPreviewDialog } from './ContractPreviewDialog'

/**
 * Icono de PDF junto a cada versión del historial: abre la vista previa del
 * contrato de ESA versión, con sus tarifas.
 *
 * Se lleva su propio estado para poder soltarlo en cualquier lista de versiones
 * sin que quien la pinta tenga que administrar el modal.
 */
export function ContractPreviewButton({
  hotelName,
  version,
}: {
  hotelName: string
  version: ProposalVersionSummary
}): ReactNode {
  const [isOpen, setIsOpen] = useState(false)
  const label = `Vista previa del contrato de la Propuesta v${version.version}`

  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => {
          setIsOpen(true)
        }}
        className="flex size-9 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-o-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
      >
        <span className="material-icons-outlined text-xl leading-none" aria-hidden>
          picture_as_pdf
        </span>
      </button>

      <ContractPreviewDialog
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false)
        }}
        hotelName={hotelName}
        version={version}
      />
    </>
  )
}
