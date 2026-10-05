import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RefreshControl } from './RefreshControl'

/**
 * Las pantallas pesadas no se refrescan solas: una recarga de la cinta del
 * Timesheet cuesta ~7 peticiones y cambiar los datos a media revisión es peor
 * que verlos un poco viejos (decisión de Hugo, 2026-10-01). Así que decide la
 * persona — y para poder decidir necesita saber de cuándo es lo que ve.
 */
describe('RefreshControl', () => {
  it('dice hace cuánto, para que se pueda decidir si vale la pena', () => {
    render(
      <RefreshControl
        onRefresh={vi.fn()}
        isFetching={false}
        fulfilledTimeStamp={Date.now() - 6 * 60_000}
        label="el Timesheet"
      />,
    )
    expect(screen.getByText('Actualizado hace 6 minutos')).toBeInTheDocument()
  })

  it('recién llegado no dice «hace 0 minutos», que suena a error', () => {
    render(
      <RefreshControl
        onRefresh={vi.fn()}
        isFetching={false}
        fulfilledTimeStamp={Date.now() - 4_000}
        label="el Timesheet"
      />,
    )
    expect(screen.getByText('Actualizado hace un momento')).toBeInTheDocument()
  })

  it('pide los datos de nuevo al presionarlo', async () => {
    const onRefresh = vi.fn()
    const user = userEvent.setup()
    render(
      <RefreshControl
        onRefresh={onRefresh}
        isFetching={false}
        fulfilledTimeStamp={Date.now()}
        label="el Timesheet"
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Actualizar el Timesheet' }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('mientras trae los datos se apaga y lo dice, en vez de dejar presionar de nuevo', () => {
    render(
      <RefreshControl
        onRefresh={vi.fn()}
        isFetching
        fulfilledTimeStamp={Date.now() - 60_000}
        label="el Timesheet"
      />,
    )
    expect(screen.getByRole('button', { name: 'Actualizar el Timesheet' })).toBeDisabled()
    expect(screen.getByText('Actualizando…')).toBeInTheDocument()
  })

  it('sin dato todavía no inventa una antigüedad', () => {
    render(
      <RefreshControl
        onRefresh={vi.fn()}
        isFetching={false}
        fulfilledTimeStamp={undefined}
        label="el Timesheet"
      />,
    )
    expect(screen.queryByText(/Actualizado hace/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Actualizar el Timesheet' })).toBeEnabled()
  })
})
