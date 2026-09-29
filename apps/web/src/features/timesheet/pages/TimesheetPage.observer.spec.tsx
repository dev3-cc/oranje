import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { TimesheetPage } from './TimesheetPage'

import { store } from '@/app/store'

/* El Observador (Hugo, 2026-09-29): el Timesheet de todos los hoteles para
   trabajar la nómina mientras se construye Contabilidad, solo en lectura.
   Referencia estable, como la que devuelve RTK Query. */
const OBSERVER_SESSION = {
  data: {
    id: 'u-obs',
    email: 'observador@casacurtidor.com',
    name: 'Observador',
    shortName: 'Observador',
    roleId: 'ROL-OBS-01',
    photoUrl: null,
    roleCode: 'OBS',
    roleTitle: 'Observador',
    hotel: null,
    department: null,
    locale: 'es',
    permissions: ['timesheet.read_all_hotels', 'observability.read_punches'],
  },
}

vi.mock('@/app/sessionApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/sessionApi')>()
  return { ...actual, useGetSessionQuery: () => OBSERVER_SESSION }
})

function renderTimesheet(): void {
  render(
    <Provider store={store}>
      <MemoryRouter>
        <TimesheetPage />
      </MemoryRouter>
    </Provider>,
  )
}

describe('TimesheetPage · Observador', () => {
  it('ve las horas de todos los hoteles sin un solo botón de escritura', async () => {
    renderTimesheet()

    expect((await screen.findAllByText('Ana Rivera Gómez')).length).toBeGreaterThan(0)
    expect(screen.getByText('Todos los hoteles · solo lectura')).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: /enviar a revisión/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /marca manual/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /aprobar semana/i })).not.toBeInTheDocument()
    // Sin pago no hay selección: la selección solo existe para pagar en bloque.
    expect(screen.queryAllByLabelText(/^Seleccionar /)).toHaveLength(0)
  })

  it('el día se abre como detalle: las marcas y cerrar, nada que guardar', async () => {
    const user = userEvent.setup()
    renderTimesheet()

    const chips = await screen.findAllByText('Observado')
    await user.click(chips.find((chip) => chip.closest('button') !== null) as HTMLElement)

    const dialog = await screen.findByRole('dialog')
    const scoped = within(dialog)
    expect(scoped.getByText('Detalle del día')).toBeInTheDocument()
    expect(scoped.getByText('Salida')).toBeInTheDocument()
    expect(scoped.queryByRole('textbox')).not.toBeInTheDocument()
    expect(scoped.queryByRole('button', { name: /revisado/i })).not.toBeInTheDocument()
    expect(scoped.queryByRole('button', { name: /marca/i })).not.toBeInTheDocument()
    expect(scoped.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
  })
})
