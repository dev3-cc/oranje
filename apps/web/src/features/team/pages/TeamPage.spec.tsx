import { render, screen, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { TeamPage } from './TeamPage'

import { store } from '@/app/store'

/**
 * Mi Equipo compone `/team` + `/prospects`: Ana Ruiz es dueña de todos los
 * fixtures de Onboarding y sus métricas salen vivas; los otros dos BDs
 * existen sin cartera, que es como se ve un equipo recién repartido.
 */
function renderTeam(): void {
  render(
    <Provider store={store}>
      <TeamPage />
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

  it('la tarjeta del BD trae sus métricas y su distribución por estado', async () => {
    renderTeam()

    const card = (await screen.findByText('Ana Ruiz')).closest('article')
    const scoped = within(card as HTMLElement)

    expect(scoped.getByText(/Zonas Norte, Centro y Sur/)).toBeInTheDocument()
    expect(scoped.getByText('Prospectos abiertos')).toBeInTheDocument()
    // La distribución usa los mismos chips del semáforo que el pipeline.
    expect(scoped.getByText(/Gris · \d/)).toBeInTheDocument()
    expect(scoped.getByText(/Azul claro · \d/)).toBeInTheDocument()
  })

  it('un BD sin cartera no finge números: ceros y sin territorio', async () => {
    renderTeam()

    const card = (await screen.findByText('Rocío Lima')).closest('article')
    const scoped = within(card as HTMLElement)

    expect(scoped.getByText('BD · sin territorio asignado todavía')).toBeInTheDocument()
    // Sin conversiones no hay promedio que inventar: raya.
    expect(scoped.getByText('—')).toBeInTheDocument()
  })

  it('las acciones sin backend están deshabilitadas y lo dicen', async () => {
    renderTeam()

    const card = (await screen.findByText('Ana Ruiz')).closest('article')
    const scoped = within(card as HTMLElement)

    expect(scoped.getByRole('button', { name: 'Nota al BD' })).toBeDisabled()
    expect(scoped.getByRole('button', { name: 'Solicitar reporte' })).toBeDisabled()
  })
})
