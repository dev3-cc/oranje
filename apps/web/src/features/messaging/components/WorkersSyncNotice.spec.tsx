import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { MessagingCampaignsList } from './MessagingCampaignsList'

import { store } from '@/app/store'

describe('Aviso de colaboradores sin sincronizar en Campañas', () => {
  it('avisa cuántos faltan y desaparece al sincronizar', async () => {
    const user = userEvent.setup()
    render(
      <Provider store={store}>
        <MessagingCampaignsList />
      </Provider>,
    )

    expect(await screen.findByText('2 colaboradores nuevos sin sincronizar')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Sincronizar colaboradores/ }))
    await user.click(await screen.findByRole('button', { name: 'Sincronizar' }))

    await waitFor(() => {
      expect(screen.queryByText(/sin sincronizar/)).not.toBeInTheDocument()
    })
  })
})
