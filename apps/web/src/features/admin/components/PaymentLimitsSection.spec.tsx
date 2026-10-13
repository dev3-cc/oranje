import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { PaymentLimitsSection } from './PaymentLimitsSection'

import { store } from '@/app/store'

function renderSection(): void {
  render(
    <Provider store={store}>
      <MemoryRouter>
        <PaymentLimitsSection />
      </MemoryRouter>
    </Provider>,
  )
}

describe('PaymentLimitsSection', () => {
  it('muestra los cuatro límites con sus horas actuales', async () => {
    renderSection()

    expect(await screen.findByLabelText(/Corte de pago/)).toHaveValue('16:00')
    expect(screen.getByLabelText(/Plazo para aprobar/)).toHaveValue('11:00')
    expect(screen.getByLabelText(/Envío de emergencia/)).toHaveValue('11:00')
    expect(screen.getByLabelText(/Correo de horas/)).toHaveValue('09:00')
  })

  it('no ofrece guardar mientras nada cambió', async () => {
    renderSection()

    await screen.findByLabelText(/Corte de pago/)

    expect(screen.getByRole('button', { name: 'Guardar límites' })).toBeDisabled()
  })

  it('al cambiar una hora se puede guardar, y guardar la deja al día', async () => {
    const user = userEvent.setup()
    renderSection()

    const corte = await screen.findByLabelText(/Corte de pago/)
    await user.clear(corte)
    await user.type(corte, '17:30')

    const guardar = screen.getByRole('button', { name: 'Guardar límites' })
    expect(guardar).toBeEnabled()

    await user.click(guardar)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Guardar límites' })).toBeDisabled(),
    )
    expect(screen.getByLabelText(/Corte de pago/)).toHaveValue('17:30')
  })
})
