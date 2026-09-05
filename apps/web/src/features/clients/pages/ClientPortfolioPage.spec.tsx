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
    [{ path: '/clientes-activos', element: <ClientPortfolioPage /> }],
    { initialEntries: ['/clientes-activos'] },
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
    // El elegido vive en la tarjeta grande; la lista trae a los otros 5.
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByRole('link', { name: 'Abrir ficha del hotel' })).toBeInTheDocument()
  })

  it('la tarjeta arma lo que vw_client no trae: contrato, zona y tarifas', async () => {
    renderPortfolio()

    const card = (await screen.findByText('Hotel Puerto Real')).closest('article')
    expect(card).not.toBeNull()

    const scoped = within(card as HTMLElement)
    expect(scoped.getByText(/Zona Centro · cliente desde/)).toBeInTheDocument()
    expect(scoped.getByText('CT-2026-0184')).toBeInTheDocument()
    expect(scoped.getByText('4 posiciones')).toBeInTheDocument()
    expect(scoped.getByText('$230.00 – $380.00')).toBeInTheDocument()
    expect(scoped.getByText('geocerca 150 m')).toBeInTheDocument()
    expect(scoped.getByText('America/Cancun')).toBeInTheDocument()
  })

  it('un hotel activado sin contrato no finge tener uno', async () => {
    renderPortfolio()

    const card = (await screen.findByText('Posada Maya Real')).closest('article')
    const scoped = within(card as HTMLElement)

    expect(scoped.getByText('sin contrato')).toBeInTheDocument()
    expect(scoped.queryByRole('link', { name: /CT-/ })).not.toBeInTheDocument()
    // Es el elegido: su artículo es la tarjeta grande, con el CTA y la geocerca en su tile.
    expect(scoped.getByRole('link', { name: 'Abrir ficha del hotel' })).toBeInTheDocument()
    expect(scoped.getByText('120 m')).toBeInTheDocument()
  })

  it('«Ver detalle» abre la ficha del hotel, y el folio su contrato', async () => {
    renderPortfolio()

    const card = (await screen.findByText('Hotel Mirador')).closest('article')
    const scoped = within(card as HTMLElement)

    expect(scoped.getByRole('link', { name: /Ver detalle/ })).toHaveAttribute(
      'href',
      '/pipeline/psp-0014',
    )
    expect(scoped.getByRole('link', { name: 'CT-2026-0098' })).toHaveAttribute(
      'href',
      '/documentos-tc/ct-0098',
    )
  })

  it('filtrar por contrato deja fuera a quien no tiene ninguno', async () => {
    const user = userEvent.setup()
    renderPortfolio()

    await screen.findByText('Posada Maya Real')
    await user.click(screen.getByLabelText('Contrato'))
    await user.click(await screen.findByRole('option', { name: 'Contrato: EXPIRED' }))

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
