import { toast } from '@oranje/ui'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it, vi } from 'vitest'

import { MessagingTemplatesList } from './MessagingTemplatesList'

import { store } from '@/app/store'

function renderTemplates(): void {
  render(
    <Provider store={store}>
      <MessagingTemplatesList />
    </Provider>,
  )
}

describe('MessagingTemplatesList', () => {
  it('muestra cada plantilla con su texto, categoría y estado', async () => {
    renderTemplates()

    expect(await screen.findByText('turno_confirmado')).toBeInTheDocument()
    expect(
      screen.getByText('Hola {{1}}, tu turno en {{2}} quedó confirmado. ¡Te esperamos!'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Utilidad · es_MX · 2 variables/)).toBeInTheDocument()
    expect(screen.getByText('Motivo del rechazo: INVALID_FORMAT')).toBeInTheDocument()
  })

  it('filtra por estado', async () => {
    const user = userEvent.setup()
    renderTemplates()
    await screen.findByText('turno_confirmado')

    await user.click(screen.getByRole('combobox', { name: 'Estado' }))
    await user.click(await screen.findByRole('option', { name: 'Estado: Rechazada' }))

    await waitFor(() => {
      expect(screen.queryByText('turno_confirmado')).not.toBeInTheDocument()
    })
    expect(screen.getByText('promo_referidos')).toBeInTheDocument()
  })

  it('sincroniza desde Meta y avisa cuántas trajo', async () => {
    const user = userEvent.setup()
    renderTemplates()
    await screen.findByText('turno_confirmado')

    /* El aviso sale por toast, y aquí no hay <Toaster> que lo pinte. */
    const success = vi.spyOn(toast, 'success')

    await user.click(screen.getByRole('button', { name: /Sincronizar desde Meta/ }))

    await waitFor(() => {
      expect(success).toHaveBeenCalledWith('4 sincronizadas: 0 nuevas y 4 actualizadas.')
    })
  })
})
