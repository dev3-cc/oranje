import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { TeamPage } from './TeamPage'

import { store } from '@/app/store'

/**
 * Mi Equipo compone `/team` + `/prospects`: Ana Ruiz es dueña de todos los
 * fixtures de Onboarding y sus métricas salen vivas; los otros dos BDs
 * existen sin cartera, que es como se ve un equipo recién repartido.
 *
 * El layout es lista-detalle: los BDs a la izquierda, el elegido a fondo a la
 * derecha (el primero queda elegido solo).
 */
function renderTeam(): void {
  const router = createMemoryRouter([{ path: '/mi-equipo', element: <TeamPage /> }], {
    initialEntries: ['/mi-equipo'],
  })
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('TeamPage', () => {
  it('los KPIs del equipo suman lo de todos los BDs', async () => {
    renderTeam()

    const kpi = (await screen.findByText('BDs a cargo')).closest('a,div')
    expect(within(kpi as HTMLElement).getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Prospectos abiertos del equipo')).toBeInTheDocument()
    expect(screen.getByText('Conversiones del trimestre')).toBeInTheDocument()
  })

  it('el primer BD queda elegido y su detalle trae métricas, chips y ciclos', async () => {
    renderTeam()

    const detail = (await screen.findByRole('heading', { name: 'Ana Ruiz' })).closest('article')
    const scoped = within(detail as HTMLElement)

    expect(scoped.getByText(/Zonas Norte, Centro y Sur/)).toBeInTheDocument()
    expect(scoped.getByText('Prospectos abiertos')).toBeInTheDocument()
    // La distribución usa los mismos chips del semáforo que el pipeline.
    expect(scoped.getByText(/Gris · \d/)).toBeInTheDocument()
    expect(scoped.getByText(/Azul claro · \d/)).toBeInTheDocument()
    // Sus ciclos enlistan hoteles que llevan a la ficha del Pipeline.
    expect(scoped.getByText('Sus ciclos abiertos')).toBeInTheDocument()
    expect(scoped.getAllByRole('link').length).toBeGreaterThan(0)
  })

  it('elegir a un BD sin cartera no finge números: ceros y sin territorio', async () => {
    const user = userEvent.setup()
    renderTeam()

    await user.click(await screen.findByRole('button', { name: /Rocío Lima/ }))

    const detail = (await screen.findByRole('heading', { name: 'Rocío Lima' })).closest('article')
    const scoped = within(detail as HTMLElement)

    expect(scoped.getByText('BD · sin territorio asignado todavía')).toBeInTheDocument()
    // Sin conversiones no hay promedio que inventar: raya.
    expect(scoped.getByText('—')).toBeInTheDocument()
  })

  it('las acciones sin backend están deshabilitadas y lo dicen', async () => {
    renderTeam()

    const detail = (await screen.findByRole('heading', { name: 'Ana Ruiz' })).closest('article')
    const scoped = within(detail as HTMLElement)

    expect(scoped.getByRole('button', { name: 'Nota al BD' })).toBeDisabled()
    expect(scoped.getByRole('button', { name: 'Solicitar reporte' })).toBeDisabled()
  })
})
