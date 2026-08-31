import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ContractListPage } from './ContractListPage'

import { store } from '@/app/store'

const SLOW = { timeout: 4000 }

function renderList(): void {
  const router = createMemoryRouter([{ path: '/documentos-tc', element: <ContractListPage /> }], {
    initialEntries: ['/documentos-tc'],
  })

  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('ContractListPage', () => {
  it('muestra el estado con el valor del enum, sin traducir', async () => {
    renderList()

    expect(await screen.findAllByText('Activo')).toHaveLength(3)
    expect(screen.getByText('Expirado')).toBeInTheDocument()
    expect(screen.getByText('Borrador')).toBeInTheDocument()
  })

  it('cuenta la vigencia en meses, en días o la da por vencida', async () => {
    renderList()

    expect(await screen.findByText('10 meses restantes')).toBeInTheDocument()
    expect(screen.getByText('3 meses restantes')).toBeInTheDocument()
    expect(screen.getByText('vence en 45 días')).toBeInTheDocument()
    expect(screen.getByText('vencido')).toBeInTheDocument()

    expect(screen.getByText('sin vigencia')).toBeInTheDocument()
    const draft = screen.getByText('CT-2026-0203').closest('tr')
    expect(within(draft as HTMLElement).getByText('— · —')).toBeInTheDocument()
  })

  it('tanto el folio como «Abrir» llevan a la ficha', async () => {
    renderList()

    expect(await screen.findByRole('link', { name: 'CT-2026-0184' })).toHaveAttribute(
      'href',
      '/documentos-tc/ct-0184',
    )

    const row = screen.getByText('CT-2026-0184').closest('tr')
    expect(within(row as HTMLElement).getByRole('link', { name: /Abrir/ })).toHaveAttribute(
      'href',
      '/documentos-tc/ct-0184',
    )
  })

  it('«Vence en» no filtra: cambia a cuáles se les grita', async () => {
    const user = userEvent.setup()
    renderList()

    expect(await screen.findByText('3 meses restantes')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Avisar cuando falten'))
    await user.click(await screen.findByRole('option', { name: 'Vence en: 180 días' }))

    expect(screen.getByText('vence en 94 días')).toBeInTheDocument()
    expect(screen.queryByText('3 meses restantes')).not.toBeInTheDocument()
    expect(screen.getByText('10 meses restantes')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(6)
  })

  it('el estado sí filtra, y lo hace en el servidor', async () => {
    const user = userEvent.setup()
    renderList()

    await screen.findByText('CT-2026-0184')
    await user.click(screen.getByLabelText('Estado'))
    await user.click(await screen.findByRole('option', { name: 'Estado: DRAFT' }))

    await waitFor(() => {
      expect(screen.queryByText('CT-2026-0184')).not.toBeInTheDocument()
    }, SLOW)
    expect(screen.getByText('CT-2026-0203')).toBeInTheDocument()
  })

  it('la búsqueda espera a que dejes de teclear', async () => {
    const user = userEvent.setup()
    renderList()

    await screen.findByText('CT-2026-0184')
    await user.type(screen.getByLabelText('Buscar por hotel o número'), 'Mirador')

    await waitFor(() => {
      expect(screen.queryByText('CT-2026-0184')).not.toBeInTheDocument()
    }, SLOW)
    expect(screen.getByText('CT-2026-0098')).toBeInTheDocument()
  })
})
