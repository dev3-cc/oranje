import { render, screen, waitFor, within } from '@testing-library/react'
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

describe('la Bolsa Self-Pick', () => {
  it('cuenta los slots libres reales y explica RR-15', async () => {
    renderSelfPick()

    expect(
      await screen.findByText('13 slots libres en 5 requisiciones autorizadas', undefined, SLOW),
    ).toBeInTheDocument()
    expect(screen.getByText(/Gana el primero que confirma \(RR-15\)/)).toBeInTheDocument()
    expect(screen.queryByText('202608190930·K7')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Zona')).toBeDisabled()
  })

  it('el filtro de posición deja solo sus renglones', async () => {
    renderSelfPick()
    const user = userEvent.setup()

    await screen.findByText('13 slots libres en 5 requisiciones autorizadas', undefined, SLOW)
    await user.selectOptions(screen.getByLabelText('Posición'), 'pos-ck')

    expect(screen.getByRole('heading', { name: 'Cocinero' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Housekeeper' })).not.toBeInTheDocument()
  })

  it('tomar un slot: los ocupados se ven, el libre se asigna y RR-15 avanza el formulario', async () => {
    renderSelfPick()
    const user = userEvent.setup()

    const folio = await screen.findByText('202608120930·K7', undefined, SLOW)
    await user.click(folio.closest('a') as HTMLElement)

    expect(await screen.findByText('Asignación de slot', undefined, SLOW)).toBeInTheDocument()
    expect(screen.getByText(/renglón 1 · Housekeeper/)).toBeInTheDocument()
    expect(await screen.findByText('María Sandoval', undefined, SLOW)).toBeInTheDocument()
    expect(screen.getAllByText('ocupado')).toHaveLength(4)
    expect(screen.getAllByText('libre')).toHaveLength(2)
    expect(screen.getByText('Asignar al slot 5')).toBeInTheDocument()

    const assignButton = screen.getByRole('button', { name: 'Asignar' })
    await user.selectOptions(screen.getByLabelText(/Colaborador/), 'wrk-0001')
    await user.selectOptions(screen.getByLabelText(/Tipo/), 'TEMPORARY')
    expect(assignButton).toBeDisabled()
    await user.selectOptions(screen.getByLabelText(/Tipo/), 'FIXED')
    expect(assignButton).toBeEnabled()

    await user.click(assignButton)

    expect(await screen.findByText('Ana Rivera Gómez', undefined, SLOW)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('Asignar al slot 6')).toBeInTheDocument()
    }, SLOW)
    expect(screen.getAllByText('ocupado')).toHaveLength(5)
  })

  it('el renglón completo lo dice, sin formulario', async () => {
    renderSelfPick()
    const user = userEvent.setup()

    const folio = await screen.findByText('202608120930·K7', undefined, SLOW)
    await user.click(folio.closest('a') as HTMLElement)

    await screen.findByText('Asignar al slot 6', undefined, SLOW)
    await user.selectOptions(screen.getByLabelText(/Colaborador/), 'wrk-0003')
    await user.click(screen.getByRole('button', { name: 'Asignar' }))

    expect(await screen.findByText('Renglón completo', undefined, SLOW)).toBeInTheDocument()
    expect(screen.getByText(/Los 6 slots están ocupados/)).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Bolsa · Self-Pick' }))
    expect(
      await screen.findByText('11 slots libres en 4 requisiciones autorizadas', undefined, SLOW),
    ).toBeInTheDocument()
    const board = screen.getByRole('list')
    expect(within(board).queryByText('202608120930·K7')).not.toBeInTheDocument()
  })
})
