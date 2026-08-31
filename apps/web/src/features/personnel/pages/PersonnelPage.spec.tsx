import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { PersonnelPage } from './PersonnelPage'

import { store } from '@/app/store'

const SLOW = { timeout: 4000 }

function renderPersonnel(): void {
  const router = createMemoryRouter([{ path: '/mi-personal', element: <PersonnelPage /> }], {
    initialEntries: ['/mi-personal'],
  })
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

/**
 * El plantel se compone de tres contratos: el Schedule pone el turno de HOY
 * (Ana, Luis y Julia están programados), el Pool pone el semáforo (Rogelio en
 * GRIS entra aunque no tenga turno) y el Timesheet las marcas.
 */
describe('PersonnelPage', () => {
  it('el plantel cruza turno y semáforo: programados de hoy + el protegido', async () => {
    renderPersonnel()

    const anaRow = (await screen.findByText('Ana Rivera Gómez', undefined, SLOW)).closest(
      'tr',
    ) as HTMLElement
    // Ana tiene turno hoy (07:00–15:30, sembrado al día de hoy a propósito).
    expect(within(anaRow).getByText('07:00–15:30')).toBeInTheDocument()

    // Rogelio no está programado, pero el GRIS protege y SE VE.
    const grayRow = screen.getByText('Rogelio Santos').closest('tr') as HTMLElement
    expect(within(grayRow).getByText('GRAY · Accidentado')).toBeInTheDocument()
    expect(within(grayRow).getByText('Protegido (Gris)')).toBeInTheDocument()
    // Al protegido NO se le ofrece Stand-by (el GRIS protege, D-27).
    expect(within(grayRow).queryByText('Mandar a Stand-by')).not.toBeInTheDocument()

    expect(screen.getByText('Asignados hoy')).toBeInTheDocument()
    expect(screen.getByText('En accidente (GRIS)')).toBeInTheDocument()
  })

  it('mandar a Stand-by exige motivo y el semáforo de la fila cambia a PINK', async () => {
    renderPersonnel()
    const user = userEvent.setup()

    // Luis está ORANGE (operativo): su fila sí ofrece Stand-by.
    const luisRow = (await screen.findByText('Luis Cabrera', undefined, SLOW)).closest(
      'tr',
    ) as HTMLElement
    await user.click(within(luisRow).getByText('Mandar a Stand-by'))
    await user.click(await screen.findByRole('button', { name: 'Continuar' }))
    await user.click(await screen.findByRole('button', { name: 'Continuar' }))

    const dialog = await screen.findByRole('dialog')
    const sendButton = within(dialog).getByRole('button', { name: 'Mandar a Stand-by' })
    // Sin motivo no pasa: la transición del seed lo marca con reason.
    expect(sendButton).toBeDisabled()

    await user.type(
      within(dialog).getByLabelText(/Motivo/),
      'Bajó la ocupación del hotel esta semana',
    )
    expect(sendButton).toBeEnabled()
    await user.click(sendButton)

    await waitFor(() => {
      const updatedRow = screen.getByText('Luis Cabrera').closest('tr') as HTMLElement
      expect(within(updatedRow).getByText('PINK · Stand-by')).toBeInTheDocument()
    }, SLOW)
    // En Rosa ya no se re-ofrece Stand-by, y el turno se lee como pausado.
    const updatedRow = screen.getByText('Luis Cabrera').closest('tr') as HTMLElement
    expect(
      within(updatedRow).queryByRole('button', { name: 'Mandar a Stand-by' }),
    ).not.toBeInTheDocument()
  })
})
