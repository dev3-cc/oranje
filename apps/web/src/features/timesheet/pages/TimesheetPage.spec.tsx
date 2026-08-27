import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { TimesheetPage } from './TimesheetPage'

import { store } from '@/app/store'

const SLOW = { timeout: 4000 }

function renderTimesheet(): void {
  render(
    <Provider store={store}>
      <TimesheetPage />
    </Provider>,
  )
}

describe('TimesheetPage', () => {
  it('el título dice la misma semana que las columnas', async () => {
    renderTimesheet()

    expect(await screen.findByText(/^Semana /)).toBeInTheDocument()
    expect(screen.getByText('Lun')).toBeInTheDocument()
    expect(screen.getByText('Dom')).toBeInTheDocument()
  })

  it('los totales de la fila los manda el backend, no las celdas visibles', async () => {
    renderTimesheet()

    const row = (await screen.findByText('Ana Rivera Gómez')).closest('div')?.parentElement
    expect(row).not.toBeNull()

    expect(within(row as HTMLElement).getByText('34h')).toBeInTheDocument()
  })

  it('la fila enseña el estado de la SEMANA: abierta, enviada o aprobada', async () => {
    renderTimesheet()

    expect((await screen.findAllByText('Abierta')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Enviada a aprobación').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Aprobada').length).toBeGreaterThan(0)
  })

  it('una ausencia dice guion, que no es lo mismo que cero horas', async () => {
    renderTimesheet()

    const row = (await screen.findByText('Luis Cabrera')).closest('div')?.parentElement
    expect(within(row as HTMLElement).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('el día con anomalía se ve Observado y abre la Revisión del día', async () => {
    const user = userEvent.setup()
    renderTimesheet()

    await user.click(await screen.findByText('Observado'))
    await user.click(await screen.findByRole('button', { name: 'Saltar' }))

    const dialog = await screen.findByRole('dialog')
    const scoped = within(dialog)
    expect(scoped.getByText('CLOCK_OUT')).toBeInTheDocument()
    expect(scoped.getByText('fuera de geocerca')).toBeInTheDocument()
    expect(scoped.getByRole('button', { name: /marcar revisado/i })).toBeDisabled()

    await user.type(scoped.getByRole('textbox'), 'Salió por el acceso de servicio')
    expect(scoped.getByRole('button', { name: /marcar revisado/i })).toBeEnabled()

    await user.click(scoped.getByRole('button', { name: /marcar revisado/i }))

    await waitFor(() => {
      expect(screen.queryByText('Observado')).not.toBeInTheDocument()
    }, SLOW)
  })

  it('elegir días arma un resumen con su requisición', async () => {
    const user = userEvent.setup()
    renderTimesheet()

    const checkboxes = await screen.findAllByLabelText(/^Seleccionar /)
    await user.click(checkboxes[0] as HTMLElement)

    const summary = screen.getByText('1 día elegido').parentElement
    expect(within(summary as HTMLElement).getByText(/^req /)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Limpiar' }))
    expect(screen.queryByText('1 día elegido')).not.toBeInTheDocument()
  })

  it('el filtro de estado de la semana va al servidor', async () => {
    const user = userEvent.setup()
    renderTimesheet()

    await screen.findByText('Julia Mendoza')
    await user.click(screen.getByLabelText('Estado'))
    await user.click(await screen.findByRole('option', { name: 'Aprobada' }))

    await waitFor(() => {
      expect(screen.queryByText('Ana Rivera Gómez')).not.toBeInTheDocument()
    }, SLOW)
    expect(screen.getByText('Julia Mendoza')).toBeInTheDocument()
  })
})
