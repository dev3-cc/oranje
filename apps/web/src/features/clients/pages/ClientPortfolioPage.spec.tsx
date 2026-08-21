import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ClientPortfolioPage } from './ClientPortfolioPage'

import { store } from '@/app/store'

/** Debounce más latencia del mock: el margen por omisión no alcanza. */
const SLOW = { timeout: 4000 }

/**
 * La cartera COMPONE `/hotels` + `/prospects` + `/contracts`: seis clientes —
 * los cinco convertidos de los fixtures de Onboarding más Posada Maya Real,
 * el activado sin contrato.
 */
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
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
  })

  it('la tarjeta arma lo que vw_client no trae: contrato, zona y tarifas', async () => {
    renderPortfolio()

    const card = (await screen.findByText('Hotel Puerto Real')).closest('article')
    expect(card).not.toBeNull()

    const scoped = within(card as HTMLElement)
    // La fecha de activación sale de los fixtures dinámicos: solo la frase.
    expect(scoped.getByText(/Zona Centro · cliente desde/)).toBeInTheDocument()
    expect(scoped.getByText('CT-2026-0184')).toBeInTheDocument()
    expect(scoped.getByText('4 posiciones')).toBeInTheDocument()
    // El rango es lo que se FACTURA al hotel: extremos del `bill_rate`.
    expect(scoped.getByText('$230.00 – $380.00')).toBeInTheDocument()
    expect(scoped.getByText('geocerca 150 m')).toBeInTheDocument()
    expect(scoped.getByText('America/Cancun')).toBeInTheDocument()
  })

  it('un hotel activado sin contrato no finge tener uno', async () => {
    renderPortfolio()

    const card = (await screen.findByText('Posada Maya Real')).closest('article')
    const scoped = within(card as HTMLElement)

    expect(scoped.getByText('sin contrato')).toBeInTheDocument()
    // Sin contrato no hay folio que abrir, pero la ficha del hotel sigue ahí.
    expect(scoped.queryByRole('link', { name: /CT-/ })).not.toBeInTheDocument()
    expect(scoped.getByRole('link', { name: /Ver detalle/ })).toBeInTheDocument()
    // La geocerca sí existe aunque el contrato no: son cosas distintas.
    expect(scoped.getByText('geocerca 120 m')).toBeInTheDocument()
  })

  it('«Ver detalle» abre la ficha del hotel, y el folio su contrato', async () => {
    renderPortfolio()

    const card = (await screen.findByText('Hotel Mirador')).closest('article')
    const scoped = within(card as HTMLElement)

    // Un cliente es un prospecto en NARANJA: su ficha es la del Pipeline.
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
    await user.selectOptions(screen.getByLabelText('Contrato'), 'EXPIRED')

    await waitFor(() => {
      expect(screen.queryByText('Posada Maya Real')).not.toBeInTheDocument()
    }, SLOW)
    expect(screen.getByText('Villas Coral')).toBeInTheDocument()
    expect(screen.queryByText('Hotel Puerto Real')).not.toBeInTheDocument()
  })
})
