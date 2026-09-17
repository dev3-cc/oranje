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
    // El elegido se ve arriba en grande Y se queda visible, resaltado, en la lista de abajo.
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    expect(screen.getByRole('link', { name: 'Abrir ficha del hotel' })).toBeInTheDocument()
  })

  it('la tarjeta arma lo que vw_client no trae: contrato, zona y tarifas', async () => {
    renderPortfolio()

    // No es el elegido por defecto: sigue en la lista, sin duplicarse.
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
    const user = userEvent.setup()
    renderPortfolio()

    await user.click(await screen.findByRole('button', { name: 'Posada Maya Real' }))
    const heading = await screen.findByRole('heading', { level: 2, name: 'Posada Maya Real' })
    const card = heading.closest('article')
    const scoped = within(card as HTMLElement)

    expect(scoped.getByText('sin contrato')).toBeInTheDocument()
    expect(scoped.queryByRole('link', { name: /CT-/ })).not.toBeInTheDocument()
    // Es el elegido: su artículo es la tarjeta grande, con el CTA y la geocerca en su tile.
    expect(scoped.getByRole('link', { name: 'Abrir ficha del hotel' })).toBeInTheDocument()
    expect(scoped.getByText('120 m')).toBeInTheDocument()
  })

  it('elegir un hotel de la lista lo manda arriba, y la fila lo dice', async () => {
    const user = userEvent.setup()
    renderPortfolio()

    const row = (await screen.findByRole('button', { name: 'Hotel Mirador' })).closest('li')
    expect(row).not.toBeNull()
    const scopedRow = within(row as HTMLElement)

    // Antes de elegirlo, la fila no dice "arriba" — nada indica que sea el elegido.
    expect(scopedRow.queryByText(/Viéndolo arriba/)).not.toBeInTheDocument()

    await user.click(scopedRow.getByRole('button', { name: 'Hotel Mirador' }))

    // Tras elegirlo, la misma fila avisa que su ficha ya está arriba.
    expect(await scopedRow.findByText(/Viéndolo arriba/)).toBeInTheDocument()
    const heading = screen.getByRole('heading', { level: 2, name: 'Hotel Mirador' })
    const spotlight = heading.closest('article')
    expect(spotlight).not.toBeNull()
    expect(
      within(spotlight as HTMLElement).getByRole('link', { name: /CT-2026-0098/ }),
    ).toHaveAttribute('href', '/contracts/ct-0098')
  })

  it('filtrar por contrato deja fuera a quien no tiene ninguno', async () => {
    const user = userEvent.setup()
    renderPortfolio()

    // Es el elegido por defecto: aparece dos veces (arriba y en su fila).
    await screen.findAllByText('Posada Maya Real')
    await user.click(screen.getByLabelText('Contrato'))
    await user.click(await screen.findByRole('option', { name: 'Contrato: Expirado' }))

    await waitFor(() => {
      expect(screen.queryByText('Posada Maya Real')).not.toBeInTheDocument()
    }, SLOW)
    expect(screen.getAllByText('Villas Coral').length).toBeGreaterThan(0)
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
    // Con un solo resultado, ese hotel es a la vez la tarjeta grande y la fila.
    expect(screen.getByRole('heading', { level: 2, name: 'Hotel Mirador' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Quitar filtros/ }))
    expect(search).toHaveValue('')
    expect(await screen.findByText('Hotel Puerto Real', undefined, SLOW)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Quitar filtros/ })).not.toBeInTheDocument()
  })
})
