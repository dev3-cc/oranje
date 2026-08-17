import { render, screen, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { DashboardPage } from './DashboardPage'

import { store } from '@/app/store'

function renderDashboard(): void {
  const router = createMemoryRouter([{ path: '/dashboard', element: <DashboardPage /> }], {
    initialEntries: ['/dashboard'],
  })

  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('DashboardPage', () => {
  it('arma el subtítulo con el dueño, sus zonas y el periodo', async () => {
    renderDashboard()

    expect(
      await screen.findByText('Ana Ruiz · BD · zonas Norte, Centro y Sur · trimestre en curso'),
    ).toBeInTheDocument()
  })

  it('da formato a las métricas: la API manda números crudos', async () => {
    renderDashboard()

    // conversionRate llega como 0.21 y averageConversionDays como 47.
    expect(await screen.findByText('21%')).toBeInTheDocument()
    expect(screen.getByText('47 d')).toBeInTheDocument()
    expect(screen.getByText('38')).toBeInTheDocument()
    expect(screen.getByText('6 sin actividad 7+ días')).toBeInTheDocument()
  })

  it('el embudo escala cada barra contra el peldaño más alto', async () => {
    renderDashboard()

    // Gris es el máximo (12): llena la pista. Verde (6) va a la mitad.
    const gris = await screen.findByRole('img', { name: 'Gris: 12 prospectos' })
    const verde = screen.getByRole('img', { name: 'Verde: 6 prospectos' })

    expect(gris.firstElementChild).toHaveStyle({ width: '100.0%' })
    expect(verde.firstElementChild).toHaveStyle({ width: '50.0%' })
  })

  it('cada prospecto inactivo enlaza a su ficha', async () => {
    renderDashboard()

    const card = (await screen.findByText('Sin actividad reciente')).closest('section')
    expect(card).not.toBeNull()

    const link = within(card as HTMLElement).getByRole('link', { name: 'Villas Coral' })
    expect(link).toHaveAttribute('href', '/pipeline/psp-0011')
  })
})
