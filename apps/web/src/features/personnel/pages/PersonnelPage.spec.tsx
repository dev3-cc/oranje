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
 * GRIS entra aunque no tenga turno) y el Timesheet las marcas. El layout es
 * lista-detalle (el patrón de Mi Equipo del BDC): la fila resume, el panel
 * profundiza.
 */
describe('PersonnelPage', () => {
  it('el plantel cruza turno y semáforo: programados de hoy + el protegido', async () => {
    renderPersonnel()
    const user = userEvent.setup()

    // El nombre vive en la fila Y en el detalle (la primera viene elegida):
    // se toma el que está dentro de un <li>.
    const anaRow = (await screen.findAllByText('Ana Rivera Gómez', undefined, SLOW))
      .map((node) => node.closest('li'))
      .find(Boolean) as HTMLElement
    // Ana tiene turno hoy (07:00–15:30, sembrado al día de hoy a propósito).
    expect(within(anaRow).getByText(/07:00–15:30/)).toBeInTheDocument()

    // Rogelio no está programado, pero el GRIS protege y SE VE en la lista.
    const grayRow = screen
      .getAllByText('Rogelio Santos')
      .map((node) => node.closest('li'))
      .find(Boolean) as HTMLElement
    expect(within(grayRow).getByText('Protegido (Gris)')).toBeInTheDocument()

    // Su detalle enseña el semáforo, y al protegido NO se le ofrece Stand-by.
    await user.click(within(grayRow).getByRole('button'))
    const detail = screen.getByRole('article')
    expect(within(detail).getByText('Accidentado')).toBeInTheDocument()
    expect(
      within(detail).queryByRole('button', { name: 'Mandar a Stand-by' }),
    ).not.toBeInTheDocument()

    expect(screen.getByText('Asignados hoy')).toBeInTheDocument()
    expect(screen.getByText('En accidente')).toBeInTheDocument()
  })

  it('el buscador filtra el plantel en memoria y el panel sigue al primero visible', async () => {
    renderPersonnel()
    const user = userEvent.setup()

    await screen.findAllByText('Ana Rivera Gómez', undefined, SLOW)
    const field = screen.getByLabelText('Buscar en tu plantel')

    // «rogelio» deja solo a Rogelio, y el panel de la derecha pasa a él.
    await user.type(field, 'rogelio')
    expect(screen.queryByText('Ana Rivera Gómez')).not.toBeInTheDocument()
    const detail = screen.getByRole('article')
    expect(within(detail).getByRole('heading', { name: 'Rogelio Santos' })).toBeInTheDocument()

    // Sin nadie visible, el panel no inventa a nadie y el vacío dice cómo salir.
    await user.clear(field)
    await user.type(field, 'zzz')
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(screen.getByText(/Nadie en tu plantel se llama «zzz»/)).toBeInTheDocument()

    // Limpiar devuelve el plantel entero.
    await user.click(screen.getByRole('button', { name: 'Limpiar la búsqueda' }))
    expect(screen.getAllByText('Ana Rivera Gómez').length).toBeGreaterThan(0)
  })

  it('mandar a Stand-by exige motivo y el semáforo cambia a PINK', async () => {
    renderPersonnel()
    const user = userEvent.setup()

    // Luis está ORANGE (operativo): su DETALLE sí ofrece Stand-by.
    const luisRow = (await screen.findAllByText('Luis Cabrera', undefined, SLOW))
      .map((node) => node.closest('li'))
      .find(Boolean) as HTMLElement
    await user.click(within(luisRow).getByRole('button'))
    const detail = screen.getByRole('article')
    await user.click(within(detail).getByRole('button', { name: 'Mandar a Stand-by' }))
    await user.click(await screen.findByRole('button', { name: 'Continuar' }))
    await user.click(await screen.findByRole('button', { name: 'Continuar' }))

    const dialog = await screen.findByRole('dialog')
    const sendButton = within(dialog).getByRole('button', { name: 'Mandar a Stand-by' })
    // Sin motivo no pasa: la transición del seed lo marca con reason.
    expect(sendButton).toBeDisabled()

    // El motivo ahora es del catálogo (encargo 12): se elige, no se redacta.
    await user.click(within(dialog).getByLabelText('Motivo del Stand-by'))
    await user.click(await screen.findByRole('option', { name: 'Temporada baja' }))
    expect(sendButton).toBeEnabled()
    await user.click(sendButton)

    // El detalle de Luis queda en Rosa y ya no re-ofrece Stand-by.
    await waitFor(() => {
      expect(screen.getAllByText('Stand-by').length).toBeGreaterThan(0)
    }, SLOW)
    const updatedDetail = screen.getByRole('article')
    expect(
      within(updatedDetail).queryByRole('button', { name: 'Mandar a Stand-by' }),
    ).not.toBeInTheDocument()
    // Y la fila de la lista lee su turno como pausado.
    const updatedRow = screen
      .getAllByText('Luis Cabrera')
      .map((node) => node.closest('li'))
      .find(Boolean) as HTMLElement
    expect(within(updatedRow).getByText(/Pausado \(Stand-by\)/)).toBeInTheDocument()
  })
})
