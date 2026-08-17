import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ContractListPage } from './ContractListPage'

import { store } from '@/app/store'

/** Debounce de búsqueda más latencia del mock: el margen por omisión no alcanza. */
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

    expect(await screen.findAllByText('ACTIVE')).toHaveLength(3)
    expect(screen.getByText('EXPIRED')).toBeInTheDocument()
    expect(screen.getByText('DRAFT')).toBeInTheDocument()
  })

  it('cuenta la vigencia en meses, en días o la da por vencida', async () => {
    renderList()

    expect(await screen.findByText('10 meses restantes')).toBeInTheDocument()
    expect(screen.getByText('3 meses restantes')).toBeInTheDocument()
    expect(screen.getByText('vence en 45 días')).toBeInTheDocument()
    expect(screen.getByText('vencido')).toBeInTheDocument()

    // Un borrador no tiene periodo: ni fechas ni cuenta regresiva.
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

    await user.selectOptions(screen.getByLabelText('Avisar cuando falten'), '180')

    // El mismo contrato, ahora dentro de la ventana de aviso...
    expect(screen.getByText('vence en 94 días')).toBeInTheDocument()
    expect(screen.queryByText('3 meses restantes')).not.toBeInTheDocument()
    // ...y ninguna fila desapareció, que es la diferencia con un filtro.
    expect(screen.getByText('10 meses restantes')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(6)
  })

  it('el estado sí filtra, y lo hace en el servidor', async () => {
    const user = userEvent.setup()
    renderList()

    await screen.findByText('CT-2026-0184')
    await user.selectOptions(screen.getByLabelText('Estado'), 'DRAFT')

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

    // Se espera a que DESAPAREZCAN los demás: «Mirador» ya estaba en pantalla
    // desde la carga inicial, así que buscarlo pasaría antes del debounce.
    await waitFor(() => {
      expect(screen.queryByText('CT-2026-0184')).not.toBeInTheDocument()
    }, SLOW)
    expect(screen.getByText('CT-2026-0098')).toBeInTheDocument()
  })
})
