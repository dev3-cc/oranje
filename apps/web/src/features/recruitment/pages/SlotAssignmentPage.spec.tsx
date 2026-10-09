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

/**
 * El gasto (Uber…) exige decir quién lo pagó antes de poder asignar (Hugo,
 * 2026-10-09): sin eso, Contabilidad no sabría si sumarle o restarle algo al
 * colaborador. El ajuste de tarifa no lo pide — ese no tiene de quién
 * reembolsar o descontar.
 */
describe('el gasto de una eventual exige decir quién lo pagó', () => {
  it('al elegir el concepto aparecen las tres disposiciones, y se puede elegir una', async () => {
    renderSelfPick()
    const user = userEvent.setup()

    const folio = await screen.findByText('202608140700·E1', undefined, SLOW)
    await user.click(folio.closest('a') as HTMLElement)
    await screen.findByText('Asignación de slot', undefined, SLOW)

    await user.click(screen.getByLabelText('Tipo'))
    await user.click(await screen.findByRole('option', { name: 'Temporal' }))

    await user.click(screen.getByLabelText(/Agregar un gasto extra/))
    await user.click(screen.getByLabelText('Concepto del gasto'))
    await user.click(await screen.findByRole('option', { name: 'Uber' }))

    const oranje = screen.getByRole('radio', { name: /Gasto de la empresa/ })
    const colaborador = screen.getByRole('radio', { name: /Lo pagó el colaborador/ })
    const descuento = screen.getByRole('radio', { name: /descontárselo/ })
    expect(oranje).not.toBeChecked()
    expect(colaborador).not.toBeChecked()
    expect(descuento).not.toBeChecked()

    await user.click(colaborador)
    expect(colaborador).toBeChecked()
    expect(oranje).not.toBeChecked()
  })
})
