import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { TimesheetPage } from './TimesheetPage'

import { store } from '@/app/store'

/** Latencia del mock: el margen por omisión se queda corto al filtrar. */
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

    // El rango se arma con los días que llegaron: 31 jul – 6 ago 2026.
    expect(await screen.findByText('Semana 31 jul – 6 ago 2026')).toBeInTheDocument()
    expect(screen.getByText('Vie')).toBeInTheDocument()
    expect(screen.getByText('31')).toBeInTheDocument()
    expect(screen.getByText('Jue')).toBeInTheDocument()
  })

  it('los totales de la fila los manda el backend, no las celdas visibles', async () => {
    renderTimesheet()

    const row = (await screen.findByText('Alejandro Ruiz')).closest('div')?.parentElement
    expect(row).not.toBeNull()

    // 33h con 7 días capturados que suman 40: el total es el de la semana.
    expect(within(row as HTMLElement).getByText('33h')).toBeInTheDocument()
    expect(within(row as HTMLElement).getByText('/ 40h')).toBeInTheDocument()
  })

  it('un día sin horas dice guion, que no es lo mismo que cero', async () => {
    renderTimesheet()

    // El turno del 5 cruza la medianoche y todavía no cierra.
    expect(await screen.findByText('17:11 – 03:40')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.getByText('7.1h')).toBeInTheDocument()
  })

  it('separa el chip de pago de la falta de requisición', async () => {
    renderTimesheet()

    // Tres filas tienen un día sin pagar; solo Sofía va al corriente.
    expect(await screen.findAllByText('Pagar 1')).toHaveLength(3)
    expect(screen.getByText('0 sin pagar')).toBeInTheDocument()
    expect(screen.getAllByText('Sin req.').length).toBeGreaterThan(0)
  })

  it('elegir días arma un resumen con su requisición', async () => {
    const user = userEvent.setup()
    renderTimesheet()

    const first = await screen.findByLabelText('Seleccionar 2026-07-31')
    await user.click(first)

    const summary = screen.getByText('1 día elegido').parentElement
    expect(within(summary as HTMLElement).getByText('SR26-104')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Limpiar' }))
    expect(screen.queryByText('1 día elegido')).not.toBeInTheDocument()
  })

  it('el zoom cambia el ancho de la columna, no lo que se ve', async () => {
    const user = userEvent.setup()
    renderTimesheet()

    await screen.findByText('Alejandro Ruiz')
    await user.click(screen.getByRole('button', { name: '180' }))

    expect(screen.getByRole('button', { name: '180' })).toHaveAttribute('aria-pressed', 'true')
    // Nadie desapareció: el zoom no filtra.
    expect(screen.getByText('Sofia Garcia')).toBeInTheDocument()
  })

  it('el filtro de hotel se resuelve en el servidor', async () => {
    const user = userEvent.setup()
    renderTimesheet()

    await screen.findByText('Camila Gomez')
    await user.selectOptions(screen.getByLabelText('Hotel'), 'Hotel Puerto Real')

    await waitFor(() => {
      expect(screen.queryByText('Camila Gomez')).not.toBeInTheDocument()
    }, SLOW)
    expect(screen.getByText('Alejandro Ruiz')).toBeInTheDocument()
    expect(screen.getByText('Sofia Garcia')).toBeInTheDocument()
  })
})
