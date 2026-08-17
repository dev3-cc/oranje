import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ClientPortfolioPage } from './ClientPortfolioPage'

import { store } from '@/app/store'

/** Debounce más latencia del mock: el margen por omisión no alcanza. */
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

    // Se pintan 5 tarjetas y el subtítulo dice 12: la lista es una página.
    expect(
      await screen.findByText('commercial.vw_client · hoteles con activated_at · 12 en cartera'),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('la tarjeta arma lo que vw_client no trae: contrato, zona y tarifas', async () => {
    renderPortfolio()

    const card = (await screen.findByText('Hotel Puerto Real')).closest('article')
    expect(card).not.toBeNull()

    const scoped = within(card as HTMLElement)
    // `formatDate` no rellena el día con cero, como en el resto de la app: la
    // maqueta dice «08 jul» pero aquí la fecha va dentro de una frase, no en
    // una columna que necesite alinearse.
    expect(scoped.getByText('Zona Centro · cliente desde 8 jul 2026')).toBeInTheDocument()
    expect(scoped.getByText('CT-2026-0184')).toBeInTheDocument()
    expect(scoped.getByText('4 posiciones')).toBeInTheDocument()
    expect(scoped.getByText('$170.00 – $260.00')).toBeInTheDocument()
    expect(scoped.getByText('geocerca 150 m')).toBeInTheDocument()
    expect(scoped.getByText('América/Cancún')).toBeInTheDocument()
  })

  it('un hotel activado sin contrato no finge tener uno', async () => {
    renderPortfolio()

    const card = (await screen.findByText('Hotel Las Palmas')).closest('article')
    const scoped = within(card as HTMLElement)

    expect(scoped.getByText('sin contrato')).toBeInTheDocument()
    // Sin contrato no hay folio que abrir, pero la ficha del hotel sigue ahí.
    expect(scoped.queryByRole('link', { name: /CT-/ })).not.toBeInTheDocument()
    expect(scoped.getByRole('link', { name: /Ver detalle/ })).toBeInTheDocument()
    // La geocerca sí existe aunque el contrato no: son cosas distintas.
    expect(scoped.getByText('geocerca 140 m')).toBeInTheDocument()
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

  it('el orden lo resuelve el servidor', async () => {
    const user = userEvent.setup()
    renderPortfolio()

    // Por omisión, del más reciente al más antiguo.
    const names = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    await waitFor(() => {
      expect(names()[0]).toBe('Hotel Puerto Real')
    }, SLOW)

    await user.selectOptions(screen.getByLabelText('Ordenar'), 'OLDEST')

    await waitFor(() => {
      expect(names()[0]).toBe('Hotel Las Palmas')
    }, SLOW)
  })

  it('filtrar por contrato deja fuera a quien no tiene ninguno', async () => {
    const user = userEvent.setup()
    renderPortfolio()

    await screen.findByText('Hotel Las Palmas')
    await user.selectOptions(screen.getByLabelText('Contrato'), 'EXPIRED')

    await waitFor(() => {
      expect(screen.queryByText('Hotel Las Palmas')).not.toBeInTheDocument()
    }, SLOW)
    expect(screen.getByText('Villas Coral')).toBeInTheDocument()
    expect(screen.queryByText('Hotel Puerto Real')).not.toBeInTheDocument()
  })
})
