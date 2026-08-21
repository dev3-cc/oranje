import { render, screen, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { ReportsPage } from './ReportsPage'

import { store } from '@/app/store'

/**
 * Reportes · Ventas compone `/team` + `/prospects` + historial e intentos de
 * cada ciclo. Ana Ruiz es la dueña de todos los fixtures: sus números salen
 * vivos; los promedios usan las historias sintetizadas de los mocks.
 */
function renderReports(): void {
  render(
    <Provider store={store}>
      <ReportsPage />
    </Provider>,
  )
}

describe('ReportsPage', () => {
  it('la conversión por BD suma el total del equipo', async () => {
    renderReports()

    const card = (await screen.findByText('Conversión por BD')).closest('section')
    const scoped = within(card as HTMLElement)

    expect(scoped.getByText('Ana Ruiz')).toBeInTheDocument()
    expect(scoped.getByText(/Total del equipo:/)).toBeInTheDocument()
  })

  it('el tiempo por color señala el cuello del pipeline', async () => {
    renderReports()

    const card = (await screen.findByText('Tiempo por color del semáforo')).closest('section')
    const scoped = within(card as HTMLElement)

    expect(scoped.getByText('Gris')).toBeInTheDocument()
    expect(scoped.getByText('Rosa')).toBeInTheDocument()
    expect(scoped.getByText(/El cuello está en/)).toBeInTheDocument()
  })

  it('los intentos cruzan canal por resultado con etiquetas humanas', async () => {
    renderReports()

    const card = (await screen.findByText('Intentos por canal × resultado')).closest('section')
    const scoped = within(card as HTMLElement)

    // Del fixture de Puerto Real: llamada y visita con sus resultados.
    expect(scoped.getByText('Llamada')).toBeInTheDocument()
    expect(scoped.getByText(/Interesado/)).toBeInTheDocument()
  })

  it('las salidas a ramas recuerdan que son reactivables', async () => {
    renderReports()

    const card = (await screen.findByText(/Motivos de salida/)).closest('section')
    const scoped = within(card as HTMLElement)

    expect(scoped.getByText(/reactivables a Azul claro \(RR-V-07\)/)).toBeInTheDocument()
  })

  it('lo que no existe está deshabilitado y lo dice', async () => {
    renderReports()

    expect(await screen.findByRole('button', { name: 'Programar envío recurrente' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Ejecutivo' })).toBeDisabled()
  })
})
