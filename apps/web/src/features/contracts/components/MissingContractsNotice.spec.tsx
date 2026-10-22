import { render, screen, waitFor } from '@testing-library/react'
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
    // Los tres prospectos elegibles de los fixtures: Puerto Real (PINK), Las
    // Palmas (YELLOW) y Villas Coral (BROWN) — ninguno tiene fila en `rows`,
    // así que los tres «faltan».
    const link = screen.getByRole('link', { name: /Hotel Puerto Real/ })
    // Lleva directo al botón de crear el contrato, con el intro si nunca lo
    // vio — no solo a la ficha (Hugo, 2026-10-20).
    expect(link).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/pipeline\/.+\?createContract=1$/),
    )
    expect(screen.getByRole('link', { name: /Hotel Las Palmas/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Villas Coral/ })).toBeInTheDocument()
  })

  it('el contador se contrae y expande sin perder los hoteles', async () => {
    const user = userEvent.setup()
    renderNotice([])

    await screen.findByText('Hoteles listos para su contrato')
    const toggle = screen.getByRole('button', { name: 'Contraer hoteles listos para su contrato' })
    expect(toggle).toHaveTextContent('3')

    await user.click(toggle)
    expect(screen.queryByRole('link', { name: /Hotel Puerto Real/ })).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Expandir hoteles listos para su contrato' }),
    )
    expect(screen.getByRole('link', { name: /Hotel Puerto Real/ })).toBeInTheDocument()
  })

  // Hotel Puerto Real, Las Palmas y Villas Coral ya tienen fila en
  // `contractsMocks` (ct-0184 Activo, ct-0203 Borrador, ct-0042 Expirado): con
  // los contratos reales de hoy, ninguno de los tres hace falta.
  it('un hotel con contrato —así sea Borrador o Expirado— ya no cuenta como faltante', async () => {
    renderNotice([
      { hotelName: 'Hotel Puerto Real' } as ContractRow,
      { hotelName: 'Hotel Las Palmas' } as ContractRow,
      { hotelName: 'Villas Coral' } as ContractRow,
    ])

    // `waitFor` reintenta durante 1 s: si la consulta de candidatos tardara en
    // resolver y el aviso apareciera tarde, lo atraparía igual.
    await waitFor(() => {
      expect(screen.queryByText('Hoteles listos para su contrato')).not.toBeInTheDocument()
    })
  })
})
