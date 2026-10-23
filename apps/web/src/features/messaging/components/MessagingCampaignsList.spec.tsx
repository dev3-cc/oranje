import { toast } from '@oranje/ui'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it, vi } from 'vitest'

import { MessagingCampaignsList } from './MessagingCampaignsList'

import { store } from '@/app/store'

function renderCampaigns(): void {
  render(
    <Provider store={store}>
      <MessagingCampaignsList />
    </Provider>,
  )
}

function rowOf(name: string): HTMLElement {
  const row = screen.getByText(name).closest('tr')
  if (row === null) throw new Error(`No hay fila para ${name}`)
  return row
}

describe('MessagingCampaignsList', () => {
  it('muestra cada campaña con su estado, avance y las acciones de su estado', async () => {
    renderCampaigns()

    await screen.findByText('Turnos de noviembre')
    const sending = within(rowOf('Turnos de noviembre'))
    expect(sending.getByText('Enviando')).toBeInTheDocument()
    expect(sending.getByText('80 de 120 enviados')).toBeInTheDocument()
    expect(sending.getByText('70 entregados · 41 leídos · 3 fallidos')).toBeInTheDocument()
    expect(sending.getByRole('button', { name: 'Pausar' })).toBeInTheDocument()
    expect(sending.queryByRole('button', { name: 'Enviar' })).not.toBeInTheDocument()

    expect(
      within(rowOf('Vacantes Cancún')).getByRole('button', { name: 'Enviar' }),
    ).toBeInTheDocument()
    expect(within(rowOf('Prueba oficina')).queryAllByRole('button')).toHaveLength(0)
  })

  it('filtra por estado', async () => {
    const user = userEvent.setup()
    renderCampaigns()
    await screen.findByText('Turnos de noviembre')

    await user.click(screen.getByRole('combobox', { name: 'Estado' }))
    await user.click(await screen.findByRole('option', { name: 'Estado: Pausada' }))

    await waitFor(() => {
      expect(screen.queryByText('Turnos de noviembre')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Recordatorio de octubre')).toBeInTheDocument()
  })

  it('enviar pide confirmación antes de mandar', async () => {
    const user = userEvent.setup()
    const success = vi.spyOn(toast, 'success')
    renderCampaigns()
    await screen.findByText('Vacantes Cancún')

    await user.click(within(rowOf('Vacantes Cancún')).getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByText('¿Enviar «Vacantes Cancún»?')).toBeInTheDocument()
    expect(success).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Enviar ahora' }))

    await waitFor(() => {
      expect(success).toHaveBeenCalledWith('«Vacantes Cancún» se está enviando.')
    })
    await waitFor(() => {
      expect(within(rowOf('Vacantes Cancún')).getByText('Enviando')).toBeInTheDocument()
    })
  })
})
