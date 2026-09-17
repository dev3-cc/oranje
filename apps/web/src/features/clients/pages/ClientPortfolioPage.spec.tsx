import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ClientPortfolioPage } from './ClientPortfolioPage'

import { store } from '@/app/store'

const SLOW = { timeout: 4000 }

function renderPortfolio(): void {
  const router = createMemoryRouter(
    [{ path: '/active-clients', element: <ClientPortfolioPage /> }],
    { initialEntries: ['/active-clients'] },
  )

  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('ClientPortfolioPage', () => {
  it('el encabezado habla de la cartera, no de lo que se ve', async () => {
    renderPortfolio()

    expect(
      await screen.findByText('commercial.vw_client · hoteles con activated_at · 6 en cartera'),
    ).toBeInTheDocument()
    // Sin un pin elegido no hay tarjeta flotante: los 6 hoteles viven solo en la rejilla.
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    expect(screen.queryByRole('link', { name: /Abrir ficha del hotel/ })).not.toBeInTheDocument()
  })

  it('la tarjeta de la rejilla lleva directo a la ficha del hotel', async () => {
    renderPortfolio()

    const link = (await screen.findByText('Hotel Puerto Real')).closest('a')
    expect(link).not.toBeNull()
    expect(link).toHaveAttribute('href', '/pipeline/psp-0012')

    const scoped = within(link as HTMLElement)
    expect(scoped.getByText(/Zona Centro · cliente desde/)).toBeInTheDocument()
    expect(scoped.getByText('4 posiciones')).toBeInTheDocument()
    expect(scoped.getByText('$230.00 – $380.00')).toBeInTheDocument()
  })

  it('un hotel activado sin contrato no finge tener uno', async () => {
    renderPortfolio()

    const link = (await screen.findByText('Posada Maya Real')).closest('a')
    const scoped = within(link as HTMLElement)

    expect(scoped.getByText('sin contrato')).toBeInTheDocument()
    expect(scoped.getByText('geocerca 120 m')).toBeInTheDocument()
    expect(scoped.getByText('Sin tarifas')).toBeInTheDocument()
  })

  it('filtrar por contrato deja fuera a quien no tiene ninguno', async () => {
    const user = userEvent.setup()
    renderPortfolio()

    await screen.findByText('Posada Maya Real')
    await user.click(screen.getByLabelText('Contrato'))
    await user.click(await screen.findByRole('option', { name: 'Contrato: Expirado' }))

    await waitFor(() => {
      expect(screen.queryByText('Posada Maya Real')).not.toBeInTheDocument()
    }, SLOW)
    expect(screen.getByText('Villas Coral')).toBeInTheDocument()
    expect(screen.queryByText('Hotel Puerto Real')).not.toBeInTheDocument()
  })

  it('buscar espera a que dejes de teclear; «Quitar filtros» regresa la cartera completa', async () => {
    const user = userEvent.setup()
    renderPortfolio()
    await screen.findByText('Hotel Puerto Real')

    const search = screen.getByLabelText('Buscar hotel')
    await user.type(search, 'mirador')
    expect(search).toHaveValue('mirador')

    await waitFor(() => {
      expect(screen.queryByText('Hotel Puerto Real')).not.toBeInTheDocument()
    }, SLOW)
    expect(screen.getByText('Hotel Mirador')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Quitar filtros/ }))
    expect(search).toHaveValue('')
    expect(await screen.findByText('Hotel Puerto Real', undefined, SLOW)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Quitar filtros/ })).not.toBeInTheDocument()
  })
})
