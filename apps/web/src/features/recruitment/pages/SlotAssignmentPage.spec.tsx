import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { SelfPickPage } from './SelfPickPage'
import { SlotAssignmentPage } from './SlotAssignmentPage'

import { store } from '@/app/store'

const SLOW = { timeout: 4000 }

function renderSelfPick(): void {
  const router = createMemoryRouter(
    [
      { path: '/self-pick', element: <SelfPickPage /> },
      { path: '/self-pick/:requisitionId/:positionId', element: <SlotAssignmentPage /> },
    ],
    { initialEntries: ['/self-pick'] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

/**
 * Regresión (2026-09-28): la Bolsa lleva directo a esta pantalla sin pasar
 * por «Unirse» en la ficha de la requisición — una recién autorizada (GREEN,
 * nadie la ha tomado) rechazaba CUALQUIER asignación con
 * `REQUISITION_NOT_IN_PROGRESS` y la Reclutadora no tenía forma de
 * resolverlo desde aquí. `req-0006` (folio 202608140700·E1) nace en GREEN,
 * sin tomar — se entra por la Bolsa, como haría cualquier Reclutadora.
 */
describe('la asignación de slot toma la requisición si hace falta (RR-15)', () => {
  it('asigna un slot de una requisición recién autorizada, sin pasar antes por Unirse', async () => {
    renderSelfPick()
    const user = userEvent.setup()

    const folio = await screen.findByText('202608140700·E1', undefined, SLOW)
    await user.click(folio.closest('a') as HTMLElement)

    expect(await screen.findByText('Asignación de slot', undefined, SLOW)).toBeInTheDocument()
    expect(screen.getByText(/Autorizada/)).toBeInTheDocument()
    expect(screen.getByText('Asignar al slot 1')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Colaborador'))
    await user.click(await screen.findByRole('option', { name: 'Ana Rivera Gómez · Zona Centro' }))
    await user.click(screen.getByRole('button', { name: 'Asignar colaborador' }))

    expect(await screen.findByText('Ana Rivera Gómez', undefined, SLOW)).toBeInTheDocument()
    expect(
      screen.queryByText('Toma la requisición antes de asignar', { exact: false }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Asignar al slot 2')).toBeInTheDocument()
  })
})
