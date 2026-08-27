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

    // Compuesto de /me: nombre, rol, zonas (sin asignar = todas) y periodo.
    expect(
      await screen.findByText(/Business Developer · zonas todas · histórico/),
    ).toBeInTheDocument()
  })

  it('da formato a las métricas: la API manda números crudos', async () => {
    renderDashboard()

    /*
     * Con los fixtures compuestos: 5 convertidos y 0 cerrados sin convertir
     * dan 100%; los 16 ciclos del tablero están abiertos.
     */
    expect(await screen.findByText('100%')).toBeInTheDocument()
    // «Tu actividad» repite el 16 (abiertos): basta con que exista al menos uno.
    expect(screen.getAllByText('16').length).toBeGreaterThan(0)
    expect(screen.getByText(/sin actividad 7\+ días/)).toBeInTheDocument()
  })

  it('el embudo monta la gráfica cuando hay ciclos abiertos', async () => {
    renderDashboard()

    const card = (await screen.findByText('Pipeline por estado')).closest('section')
    expect(card).not.toBeNull()
    // La dona de shadcn monta su ChartContainer; la leyenda trae los estados.
    const chart = (card as HTMLElement).querySelector('[data-slot="chart"]')
    expect(chart).not.toBeNull()
    expect(within(card as HTMLElement).getByText('Gris')).toBeInTheDocument()
  })

  it('cada prospecto inactivo enlaza a su ficha', async () => {
    renderDashboard()

    const card = (await screen.findByText('Sin actividad reciente')).closest('section')
    expect(card).not.toBeNull()

    /*
     * Puerto Real: sus intentos de fixture son de junio — el más inactivo.
     * Aparece dos veces porque los fixtures duplican los convertidos.
     */
    const links = within(card as HTMLElement).getAllByRole('link', { name: 'Hotel Puerto Real' })
    expect(links.map((link) => link.getAttribute('href'))).toContain('/pipeline/psp-0007')
  })
})
