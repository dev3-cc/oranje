import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProposalVersionSummary } from '../types/proposal.types'

import { ContractPreviewDialog } from './ContractPreviewDialog'

const VERSION: ProposalVersionSummary = {
  id: 'prp-0008-1',
  version: 1,
  status: 'SENT',
  sentAt: '2026-05-21',
  byName: 'Ana Ruiz',
  servicesNote: 'Housekeeping para temporada alta.',
  payRate: 170,
  billRate: 250,
}

let printRoot: HTMLElement

beforeEach(() => {
  printRoot = document.createElement('div')
  printRoot.id = 'print-root'
  document.body.append(printRoot)
})

afterEach(() => {
  printRoot.remove()
})

function renderDialog(): void {
  render(
    <ContractPreviewDialog isOpen onClose={vi.fn()} hotelName="Hotel Mirador" version={VERSION} />,
  )
}

describe('ContractPreviewDialog', () => {
  /**
   * Regresión: el documento vivía SOLO dentro del modal, que tiene
   * `overflow-y: auto` y `max-height`. Al imprimir salía nada más el trozo que
   * cabía en pantalla. La copia imprimible tiene que estar fuera de #root.
   */
  it('portaliza una copia imprimible fuera del modal', () => {
    renderDialog()

    const printable = within(printRoot)
    expect(printable.getByText('Contrato de prestación de servicios')).toBeInTheDocument()
    expect(printable.getByText('$170.00')).toBeInTheDocument()
    expect(printable.getByText('$250.00')).toBeInTheDocument()
    expect(printable.getByText('$80.00 · 32.0%')).toBeInTheDocument()
  })

  it('la copia imprimible lleva todos los datos de la propuesta', () => {
    renderDialog()

    const printable = within(printRoot)
    expect(printable.getByText('Housekeeping para temporada alta.')).toBeInTheDocument()
    expect(printable.getByText('v1')).toBeInTheDocument()
    expect(printable.getByText('Enviada')).toBeInTheDocument()
    expect(printable.getByText('21 may 2026')).toBeInTheDocument()
    expect(printable.getByText('Ana Ruiz')).toBeInTheDocument()
    expect(printable.getByText('Hotel Mirador')).toBeInTheDocument()
    // El aviso se imprime: un borrador sin marca puede circular como el bueno.
    expect(printable.getByText(/SIN VALIDEZ LEGAL/)).toBeInTheDocument()
  })

  it('el diálogo en pantalla muestra el mismo documento', () => {
    renderDialog()

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Contrato de prestación de servicios')).toBeInTheDocument()
  })
})
