import { toast } from '@oranje/ui'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it, vi } from 'vitest'

import { CreateCampaignDialog } from './CreateCampaignDialog'
import { MessagingCampaignsList } from './MessagingCampaignsList'

import { store } from '@/app/store'

describe('CreateCampaignDialog', () => {
  it('crea el borrador con la plantilla, sus variables y las etiquetas elegidas', async () => {
    const user = userEvent.setup()
    const success = vi.spyOn(toast, 'success')
    const onClose = vi.fn()
    render(
      <Provider store={store}>
        <CreateCampaignDialog onClose={onClose} />
      </Provider>,
    )

    await user.type(screen.getByLabelText('Nombre *'), 'Turnos Riu')
    await user.click(await screen.findByRole('combobox', { name: 'Plantilla' }))
    await user.click(await screen.findByRole('option', { name: /turno_confirmado/ }))

    // {{1}} ya viene con el nombre; {{2}} es texto fijo.
    await user.type(screen.getByLabelText('Texto de la variable 2'), 'Riu Cancún')
    expect(
      screen.getByText('Hola [Nombre], tu turno en Riu Cancún quedó confirmado. ¡Te esperamos!'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: 'Hotel' }))
    await user.click(await screen.findByRole('option', { name: 'Riu Cancún' }))

    await user.click(screen.getByRole('button', { name: 'Crear borrador' }))

    await waitFor(() => {
      expect(success).toHaveBeenCalledWith(
        'Borrador «Turnos Riu» creado: le llegaría a 10 colaboradores.',
      )
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('pide el texto de cada variable fija', async () => {
    const user = userEvent.setup()
    render(
      <Provider store={store}>
        <CreateCampaignDialog onClose={vi.fn()} />
      </Provider>,
    )

    await user.type(screen.getByLabelText('Nombre *'), 'Sin texto')
    await user.click(await screen.findByRole('combobox', { name: 'Plantilla' }))
    await user.click(await screen.findByRole('option', { name: /turno_confirmado/ }))
    await user.click(screen.getByRole('button', { name: 'Crear borrador' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Escribe el texto de cada variable fija.',
    )
  })

  it('«Nueva campaña» está bloqueado mientras haya colaboradores sin sincronizar', async () => {
    render(
      <Provider store={store}>
        <MessagingCampaignsList />
      </Provider>,
    )

    await screen.findByText(/sin sincronizar/)
    expect(screen.getByRole('button', { name: /Nueva campaña/ })).toBeDisabled()
  })
})
