import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { PendingHotelUsers } from './PendingHotelUsers'

import { store } from '@/app/store'

const SLOW = { timeout: 4000 }

function renderCard(): void {
  render(
    <Provider store={store}>
      <PendingHotelUsers />
    </Provider>,
  )
}

describe('PendingHotelUsers', () => {
  it('aprobar activa la cuenta y la quita de la lista', async () => {
    const user = userEvent.setup()
    renderCard()

    const row = (await screen.findByText('Lucía Vargas', undefined, SLOW)).closest(
      'li',
    ) as HTMLElement

    await user.click(within(row).getByRole('button', { name: 'Aprobar' }))

    await waitFor(() => {
      expect(screen.queryByText('Lucía Vargas')).not.toBeInTheDocument()
    }, SLOW)
  })

  it('rechazar exige motivo (4 letras) antes de dejar confirmar', async () => {
    const user = userEvent.setup()
    renderCard()

    const row = (await screen.findByText('Tomás Rivera', undefined, SLOW)).closest(
      'li',
    ) as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Rechazar' }))

    const confirmar = within(row).getByRole('button', { name: 'Confirmar rechazo' })
    expect(confirmar).toBeDisabled()

    await user.type(within(row).getByLabelText('Motivo del rechazo'), 'no')
    expect(confirmar).toBeDisabled()

    await user.type(within(row).getByLabelText('Motivo del rechazo'), ' es la persona correcta')
    expect(confirmar).toBeEnabled()

    await user.click(confirmar)

    await waitFor(() => {
      expect(screen.queryByText('Tomás Rivera')).not.toBeInTheDocument()
    }, SLOW)
  })
})
