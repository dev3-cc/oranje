import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  rates: [
    {
      id: 'rate-1',
      positionId: 'pos-hk',
      positionName: 'Housekeeper',
      payRate: 15,
      billRate: 19.5,
    },
  ],
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
    expect(printable.getByText('Service Agreement')).toBeInTheDocument()
    /* El cuadro por puesto es lo que se imprime, en el Exhibit «A». */
    expect(printable.getByText('Housekeeper')).toBeInTheDocument()
    expect(printable.getByText('$15.00')).toBeInTheDocument()
    expect(printable.getByText('$19.50')).toBeInTheDocument()
  })

  it('la copia imprimible lleva todos los datos de la propuesta', () => {
    renderDialog()

    const printable = within(printRoot)
    expect(printable.getByText(/Housekeeping para temporada alta\./)).toBeInTheDocument()
    expect(printable.getAllByText('Hotel Mirador').length).toBeGreaterThan(0)
    /* El clausulado completo del acuerdo vigente, no un resumen. */
    expect(printable.getAllByText('TERM AND RENEWAL.').length).toBeGreaterThan(0)
    expect(printable.getByText('DISPUTE RESOLUTION; GOVERNING LAW.')).toBeInTheDocument()
    expect(printable.getByText('AMENDMENTS; ENTIRE AGREEMENT; COUNTERPARTS.')).toBeInTheDocument()
    expect(printable.getByText(/laws of the State of Georgia/)).toBeInTheDocument()
  })

  /** Sin firmas por decisión de Hugo: las líneas van en blanco. */
  it('deja las firmas en blanco', () => {
    renderDialog()

    const printable = within(printRoot)
    expect(printable.getAllByText(/^Name\/Title:/)).toHaveLength(2)
    expect(
      printable.getByText('I AGREE TO THE RATES AND TERMS IN THIS EXHIBIT “A”'),
    ).toBeInTheDocument()
    expect(printable.queryByText('Irene Enrriquez')).not.toBeInTheDocument()
  })

  it('el diálogo en pantalla muestra el mismo documento', () => {
    renderDialog()

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Service Agreement')).toBeInTheDocument()
  })

  /**
   * El anexo es texto FIJO, igual para todos los hoteles: va en la plantilla y
   * no como dato de la propuesta.
   */
  it('imprime el anexo con las condiciones del personal', () => {
    renderDialog()

    const printable = within(printRoot)
    expect(printable.getByText('Exhibit “A” - Rates and Staffing Terms')).toBeInTheDocument()
    expect(printable.getByText(/employees of Strategic Deployment, LLC/)).toBeInTheDocument()
    expect(
      printable.getByText(/Employee screening will be performed in accordance with Section 13/),
    ).toBeInTheDocument()
  })

  it('el botón de correo arma el mensaje con el cuadro y el destinatario', async () => {
    const user = userEvent.setup()
    const assign = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        set href(value: string) {
          assign(value)
        },
      },
    })

    render(
      <ContractPreviewDialog
        isOpen
        onClose={vi.fn()}
        hotelName="Hotel Mirador"
        contactEmail="gerencia@mirador.test"
        senderName="Ana Ruiz"
        version={VERSION}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Enviar por correo' }))

    const url = String(assign.mock.calls[0]?.[0])
    expect(url.startsWith('mailto:gerencia@mirador.test?')).toBe(true)
    expect(decodeURIComponent(url)).toContain('Propuesta de servicios Oranje para Hotel Mirador')
    expect(decodeURIComponent(url)).toContain('Housekeeper')
    expect(decodeURIComponent(url)).toContain('Ana Ruiz')
  })
})
