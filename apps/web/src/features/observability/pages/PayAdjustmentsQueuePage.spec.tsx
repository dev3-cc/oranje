import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { PayAdjustmentsQueuePage } from './PayAdjustmentsQueuePage'

import { store } from '@/app/store'
// eslint-disable-next-line no-restricted-imports
import { seedPendingPayAdjustment } from '@/features/recruitment/api/payAdjustmentsMocks'

function renderQueue(): void {
  render(
    <Provider store={store}>
      <PayAdjustmentsQueuePage />
    </Provider>,
  )
}

/**
 * La única pantalla de escritura del Observador (Hugo, 2026-10-08): el
 * ajuste de tarifa o el gasto extra de una asignación eventual, pedido por
 * Reclutamiento.
 */
describe('la cola de ajustes pendientes', () => {
  it('aprueba un ajuste y desaparece de la cola', async () => {
    const row = seedPendingPayAdjustment({
      worker: { id: 'w-1', fullName: 'Juan David Pérez' },
      amount: '95.00',
      reason: 'Uber de ida y vuelta al hotel',
    })
    renderQueue()
    const user = userEvent.setup()

    expect(await screen.findByText('Juan David Pérez · Hotel de prueba')).toBeInTheDocument()
    expect(screen.getByText('«Uber de ida y vuelta al hotel»')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Aprobar' }))

    expect(
      await screen.findByText('Sin ajustes pendientes: nada que aprobar por ahora.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(row.worker.fullName)).not.toBeInTheDocument()
  })

  it('rechaza un ajuste con motivo, y el botón exige el motivo', async () => {
    seedPendingPayAdjustment({
      worker: { id: 'w-2', fullName: 'Rosa Prueba' },
      amount: '60.00',
      reason: 'Ajuste de tarifa por antigüedad',
      payConcept: null,
    })
    renderQueue()
    const user = userEvent.setup()

    await screen.findByText('Rosa Prueba · Hotel de prueba')
    await user.click(screen.getByRole('button', { name: 'Rechazar' }))

    expect(await screen.findByText('Rechazar ajuste')).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'Sí, rechazar' })
    expect(confirm).toBeDisabled()

    await user.type(screen.getByLabelText('Motivo del rechazo'), 'no procede')
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    expect(
      await screen.findByText('Sin ajustes pendientes: nada que aprobar por ahora.'),
    ).toBeInTheDocument()
  })
})
