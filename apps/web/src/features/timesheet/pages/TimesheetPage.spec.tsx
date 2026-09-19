import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { TimesheetPage } from './TimesheetPage'

import { store } from '@/app/store'

const SLOW = { timeout: 4000 }

function renderTimesheet(): void {
  render(
    <Provider store={store}>
      {/* El badge de requisición es un Link: la página necesita un Router. */}
      <MemoryRouter>
        <TimesheetPage />
      </MemoryRouter>
    </Provider>,
  )
}

describe('TimesheetPage', () => {
  it('el título dice la misma semana que las columnas', async () => {
    renderTimesheet()

    expect(await screen.findByText(/^Semana /)).toBeInTheDocument()
    // La cinta continua trae un «Lun» por cada semana cargada.
    expect((await screen.findAllByText('Lun')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Dom').length).toBeGreaterThan(0)
  })

  it('los totales de la fila los manda el backend, no las celdas visibles', async () => {
    renderTimesheet()

    // La página dibuja dos variantes (móvil + escritorio): puede haber duplicados.
    expect((await screen.findAllByText('Ana Rivera Gómez')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('34h').length).toBeGreaterThan(0)
  })

  it('la fila enseña el estado de la SEMANA: abierta, enviada o aprobada', async () => {
    renderTimesheet()

    expect((await screen.findAllByText('Abierta')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Enviada a aprobación').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Aprobada').length).toBeGreaterThan(0)
  })

  it('una ausencia dice guion, que no es lo mismo que cero horas', async () => {
    renderTimesheet()

    // La FILA de escritorio es el ancestro con borde inferior (tarjeta + celdas);
    // la variante móvil duplica el nombre, así que se busca la que lo tiene.
    const row = (await screen.findAllByText('Luis Cabrera'))
      .map((name) => name.closest('div.border-b'))
      .find(Boolean)
    expect(within(row as HTMLElement).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('el día con anomalía se ve Observado y abre la Revisión del día', async () => {
    const user = userEvent.setup()
    renderTimesheet()

    // «Observado» vive también en la leyenda: el del día es el que está en un botón.
    const chips = await screen.findAllByText('Observado')
    await user.click(chips.find((chip) => chip.closest('button') !== null) as HTMLElement)
    await user.click(await screen.findByRole('button', { name: 'Saltar' }))

    const dialog = await screen.findByRole('dialog')
    const scoped = within(dialog)
    expect(scoped.getByText('Salida')).toBeInTheDocument()
    expect(scoped.getByText('Fuera de la geocerca')).toBeInTheDocument()
    expect(scoped.getByRole('button', { name: /marcar revisado/i })).toBeDisabled()

    await user.type(scoped.getByRole('textbox'), 'Salió por el acceso de servicio')
    expect(scoped.getByRole('button', { name: /marcar revisado/i })).toBeEnabled()

    await user.click(scoped.getByRole('button', { name: /marcar revisado/i }))

    await waitFor(() => {
      const remaining = screen
        .queryAllByText('Observado')
        .filter((chip) => chip.closest('button') !== null)
      expect(remaining).toHaveLength(0)
    }, SLOW)
  })

  it('elegir días arma un resumen con su requisición', async () => {
    const user = userEvent.setup()
    renderTimesheet()

    const checkboxes = await screen.findAllByLabelText(/^Seleccionar /)
    await user.click(checkboxes[0] as HTMLElement)

    const summary = screen.getByText('1 día elegido').parentElement
    expect(within(summary as HTMLElement).getByText(/^req /)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Quitar selección' }))
    expect(screen.queryByText('1 día elegido')).not.toBeInTheDocument()
  })

  it('el filtro de estado de la semana va al servidor', async () => {
    const user = userEvent.setup()
    renderTimesheet()

    await screen.findAllByText('Julia Mendoza')
    await user.click(screen.getByLabelText('Estado'))
    await user.click(await screen.findByRole('option', { name: 'Aprobada' }))

    // Luis no tiene NINGUNA semana aprobada: su fila se va de la cinta. Ana
    // conserva la suya (la semana anterior está aprobada), pero la semana
    // visible queda en silencio.
    await waitFor(() => {
      expect(screen.queryAllByText('Luis Cabrera')).toHaveLength(0)
    }, SLOW)
    expect(screen.getAllByText('Julia Mendoza').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sin timesheet esta semana').length).toBeGreaterThan(0)
  })
})
