import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { PayAdjustmentsInclusionPage } from './PayAdjustmentsInclusionPage'

import { store } from '@/app/store'
// eslint-disable-next-line no-restricted-imports
import { seedApprovedPendingInclusion } from '@/features/recruitment/api/payAdjustmentsMocks'

function renderPage(): void {
  render(
    <Provider store={store}>
      <PayAdjustmentsInclusionPage />
    </Provider>,
  )
}

/**
 * Que el Manager de QA apruebe el ajuste/gasto de una eventual no lo mete a la
 * nómina (Hugo, 2026-10-09): Contabilidad lo ve aquí y decide, viendo antes
 * qué le pasaría al pago del colaborador.
 */
describe('los ajustes a incluir de Contabilidad', () => {
  it('incluye un ajuste aprobado, viendo antes la consecuencia, y desaparece de la lista', async () => {
    const row = seedApprovedPendingInclusion({
      worker: { id: 'w-1', fullName: 'Juan David Pérez' },
      amount: '95.00',
      reason: 'Uber de ida y vuelta al hotel',
      settlementEffect: 'REIMBURSE',
    })
    renderPage()
    const user = userEvent.setup()

    // El onboarding se ve una vez; se salta para llegar a la lista.
    await user.click(await screen.findByRole('button', { name: 'Saltar' }))

    expect(await screen.findByText('Juan David Pérez · Hotel de prueba')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Incluir en la nómina' }))

    expect(await screen.findByRole('heading', { name: 'Incluir en la nómina' })).toBeInTheDocument()
    expect(screen.getByText(/se le suma al colaborador/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sí, inclúyelo' }))

    expect(
      await screen.findByText(
        'Sin ajustes por incluir: no hay nada aprobado pendiente de decisión.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(row.worker.fullName)).not.toBeInTheDocument()
  })
})
