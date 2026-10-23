import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import type { ContractRow } from '../types/contract.types'

import { MissingContractsNotice } from './MissingContractsNotice'

import { store } from '@/app/store'

function renderNotice(rows: ContractRow[]): void {
  render(
    <Provider store={store}>
      <MemoryRouter>
        <MissingContractsNotice rows={rows} />
      </MemoryRouter>
    </Provider>,
  )
}

describe('MissingContractsNotice', () => {
  it('sin ningún contrato, enseña a los hoteles que ya pasaron Amarillo y enlaza a su prospecto', async () => {
    renderNotice([])

    expect(await screen.findByText('Hoteles listos para su contrato')).toBeInTheDocument()
    // El fixture compartido reutiliza algunos nombres de hotel entre
    // prospectos distintos (ver el caso de Naranja más abajo): se verifica
    // que aparezcan, no que sean el único resultado con ese nombre.
    const puertoReal = screen.getAllByRole('link', { name: /Hotel Puerto Real/ })
    expect(puertoReal.length).toBeGreaterThan(0)
    // Lleva directo al botón de crear el contrato, con el intro si nunca lo
    // vio — no solo a la ficha (Hugo, 2026-10-20).
    for (const link of puertoReal) {
      expect(link).toHaveAttribute(
        'href',
        expect.stringMatching(/^\/pipeline\/.+\?createContract=1$/),
      )
    }
    expect(screen.getAllByRole('link', { name: /Hotel Las Palmas/ }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Villas Coral/ }).length).toBeGreaterThan(0)
  })

  // Hugo, 2026-10-23: Villa Magna llegó a Naranja y se quedó sin contrato
  // (se restauró el hotel sin que nunca hubiera tenido uno) — no aparecía
  // aquí porque Naranja no estaba en CONTRACT_ELIGIBLE_STATUSES, aunque la
  // ficha del prospecto (`ProspectDetailPage`) sí ofrecía crearlo. Mismo
  // criterio en los dos lugares ahora: el fixture psp-0012 es un Puerto Real
  // en Naranja, prospecto distinto del que ya está en Rosa (psp-0007).
  it('un Naranja sin contrato también cuenta como faltante, no solo Amarillo en adelante', async () => {
    renderNotice([])

    await screen.findByText('Hoteles listos para su contrato')
    const naranja = screen
      .getAllByRole('link', { name: /Hotel Puerto Real/ })
      .find((link) => link.getAttribute('href')?.includes('psp-0012'))

    expect(naranja).toBeDefined()
    expect(naranja).toHaveTextContent('Naranja')
  })

  it('el contador se contrae y expande sin perder los hoteles', async () => {
    const user = userEvent.setup()
    renderNotice([])

    await screen.findByText('Hoteles listos para su contrato')
    const toggle = screen.getByRole('button', { name: 'Contraer hoteles listos para su contrato' })
    const total = screen.getAllByRole('link').length
    expect(total).toBeGreaterThan(0)

    await user.click(toggle)
    expect(screen.queryAllByRole('link')).toHaveLength(0)

    await user.click(
      screen.getByRole('button', { name: 'Expandir hoteles listos para su contrato' }),
    )
    expect(screen.getAllByRole('link')).toHaveLength(total)
  })

  // Villas Coral ya tiene fila en `contractsMocks` (ct-0042 Expirado): con el
  // contrato real de hoy, ya no hace falta — aunque siga Expirado. Se mide
  // contra el Naranja (psp-0012, único por href) para no depender de que
  // "Villas Coral" sea un nombre sin duplicados en el fixture compartido.
  it('un hotel con contrato —así sea Borrador o Expirado— ya no cuenta como faltante', async () => {
    renderNotice([])
    await screen.findByText('Hoteles listos para su contrato')
    const before = screen
      .getAllByRole('link', { name: /Hotel Puerto Real/ })
      .some((link) => link.getAttribute('href')?.includes('psp-0012'))
    expect(before).toBe(true)

    cleanup()
    renderNotice([{ hotelName: 'Hotel Puerto Real' } as ContractRow])

    // `waitFor` reintenta durante 1 s: si la consulta de candidatos tardara en
    // resolver y el aviso apareciera tarde, lo atraparía igual.
    await waitFor(() => {
      const after = screen
        .queryAllByRole('link', { name: /Hotel Puerto Real/ })
        .some((link) => link.getAttribute('href')?.includes('psp-0012'))
      expect(after).toBe(false)
    })
  })
})
