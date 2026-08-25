import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it, vi } from 'vitest'

import type { HotelContact } from '../types/prospect.types'

import { RegisterAttemptDialog } from './RegisterAttemptDialog'

import { store } from '@/app/store'

const CONTACTS: HotelContact[] = [
  {
    id: 'ctc-marta',
    name: 'Marta Solís',
    role: 'Gerente de Compras',
    phone: '+52 998 111 2233',
    email: '',
    isPrimary: true,
  },
]

async function pick(triggerLabel: string, optionName: string): Promise<void> {
  await userEvent.click(screen.getByLabelText(triggerLabel))
  await userEvent.click(await screen.findByRole('option', { name: optionName }))
}

function renderDialog(onClose = vi.fn()): { onClose: ReturnType<typeof vi.fn> } {
  render(
    <Provider store={store}>
      <RegisterAttemptDialog
        isOpen
        onClose={onClose}
        prospectId="psp-0007"
        hotelName="Hotel Puerto Real"
        contacts={CONTACTS}
      />
    </Provider>,
  )

  return { onClose }
}

describe('RegisterAttemptDialog', () => {
  it('no deja registrar hasta que hay tipo y resultado', async () => {
    renderDialog()

    const submit = screen.getByRole('button', { name: 'Registrar intento' })
    expect(submit).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Llamada' }))
    expect(submit).toBeDisabled()

    await pick('Resultado', 'Interesado')
    await waitFor(() => {
      expect(submit).toBeEnabled()
    })
  })

  it('el contacto es opcional: ofrece registrar sin nadie', () => {
    renderDialog()

    const contactSelect = screen.getByLabelText('Contacto del hotel')
    expect(contactSelect).toHaveTextContent('Sin contacto identificado')
  })

  it('registra el intento y cierra el modal', async () => {
    const { onClose } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Visita en frío' }))
    await pick('Resultado', 'Cita agendada')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar intento' }))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce()
    })
  })
})
