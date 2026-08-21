import { render, screen, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { SchedulePage } from './SchedulePage'

import { store } from '@/app/store'

/**
 * El Schedule compone `/schedules` (semana de Villas Coral) + sus entradas +
 * `/requisitions` (la demanda de `req-0005`): Houseman 1/4 y Housekeeper 2/2.
 */
function renderSchedule(): void {
  render(
    <Provider store={store}>
      <SchedulePage />
    </Provider>,
  )
}

describe('SchedulePage', () => {
  it('encabeza con el hotel y la semana del schedule', async () => {
    renderSchedule()

    expect(await screen.findByText(/Villas Coral · Semana /)).toBeInTheDocument()
    expect(screen.getByText('Lun')).toBeInTheDocument()
    expect(screen.getByText('Dom')).toBeInTheDocument()
  })

  it('la demanda dice cuánto pide cada posición y cuánto está cubierto', async () => {
    renderSchedule()

    expect(await screen.findByText('Houseman')).toBeInTheDocument()
    expect(screen.getByText(/07:00 · demanda 4/)).toBeInTheDocument()
    // 1 de 4: tres huecos, en cada día de la semana (cobertura por posición).
    expect(screen.getAllByText('3 huecos').length).toBeGreaterThan(0)
    expect(screen.getAllByText('cubierto').length).toBeGreaterThan(0)
  })

  it('el pie suma la semana y manda los huecos a la Bolsa', async () => {
    renderSchedule()

    expect(await screen.findByText(/% cubierto/)).toBeInTheDocument()
    expect(screen.getByText(/se asignan desde la Bolsa de la Reclutadora/)).toBeInTheDocument()
  })

  it('los programados reales aparecen por día con su turno', async () => {
    renderSchedule()

    const section = (await screen.findByText('Programados esta semana')).closest('section')
    const scoped = within(section as HTMLElement)

    expect(scoped.getAllByText('Ana Rivera Gómez').length).toBeGreaterThan(1)
    expect(scoped.getAllByText(/07:00 – 15:30/).length).toBeGreaterThan(0)
  })
})
