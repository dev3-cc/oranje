import { toast } from '@oranje/ui'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it, vi } from 'vitest'

import { SyncWorkersButton } from './SyncWorkersButton'

import { store } from '@/app/store'

describe('SyncWorkersButton', () => {
  it('sincroniza y avisa cuántos entraron y cuántos se saltaron', async () => {
    const user = userEvent.setup()
    const success = vi.spyOn(toast, 'success')
    const warning = vi.spyOn(toast, 'warning')
    const info = vi.spyOn(toast, 'info')
    render(
      <Provider store={store}>
        <SyncWorkersButton />
      </Provider>,
    )

    await user.click(screen.getByRole('button', { name: /Sincronizar colaboradores/ }))
    expect(
      await screen.findByText(/Se registran o actualizan 12 colaboradores como contactos/),
    ).toBeInTheDocument()
    expect(success).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Sincronizar' }))

    await waitFor(() => {
      expect(success).toHaveBeenCalledWith('12 enviados a Mensajería: 2 nuevos y 10 actualizados.')
    })
    expect(info).toHaveBeenCalledWith('Lista negra: 1 dejan de recibir y 0 vuelven a recibir.')
    expect(warning).toHaveBeenCalledWith(
      'No se enviaron 3: 2 sin teléfono y 1 con teléfono inválido.',
      expect.objectContaining({ action: expect.objectContaining({ label: 'Ver' }) as unknown }),
    )
  })
})
