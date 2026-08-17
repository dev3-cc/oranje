import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import type { HotelContact } from '../types/prospect.types'

import { HotelContactsDialog } from './HotelContactsDialog'

import { store } from '@/app/store'

const CONTACTS: HotelContact[] = [
  {
    id: 'ctc-marta',
    name: 'Marta Solís',
    role: 'Gerente de Compras',
    phone: '+52 998 111 2233',
    email: 'marta.solis@puertoreal.mx',
    isPrimary: true,
  },
  {
    id: 'ctc-jorge',
    name: 'Jorge Peña',
    role: 'Ama de Llaves',
    phone: '+52 998 444 5566',
    email: '',
    isPrimary: false,
  },
]

function renderDialog(): void {
  render(
    <Provider store={store}>
      <HotelContactsDialog
        isOpen
        onClose={() => undefined}
        prospectId="psp-0007"
        hotelName="Hotel Puerto Real"
        contacts={CONTACTS}
      />
    </Provider>,
  )
}

describe('HotelContactsDialog', () => {
  it('cuenta aparte lo registrado y lo que todavía no se guarda', () => {
    renderDialog()

    expect(screen.getByText('2 registrados · 1 sin guardar')).toBeInTheDocument()
    expect(screen.getByText('Contacto nuevo')).toBeInTheDocument()
  })

  it('solo el nombre es obligatorio', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: 'Agregar contacto' }))
    expect(await screen.findByText('El nombre es obligatorio')).toBeInTheDocument()

    // Puesto, teléfono y correo siguen vacíos y no se quejan.
    expect(screen.getByText('job_title')).toBeInTheDocument()
    expect(screen.getByText('phone')).toBeInTheDocument()
  })

  it('el correo, si se escribe, tiene que ser un correo', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.type(screen.getByPlaceholderText('Nombre y apellidos'), 'Luis Cano')
    await user.type(screen.getByPlaceholderText('nombre@hotel.mx'), 'luis-arroba-hotel')
    await user.click(screen.getByRole('button', { name: 'Agregar contacto' }))

    expect(await screen.findByText('Escribe un correo válido')).toBeInTheDocument()
  })

  it('dice quién tiene hoy el principal, que es lo que impide marcarlo', () => {
    renderDialog()

    expect(screen.getByText('is_primary · apagado: Marta Solís ya lo es')).toBeInTheDocument()
  })

  it('se pueden encolar varios y solo uno queda como principal', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.type(screen.getByPlaceholderText('Nombre y apellidos'), 'Luis Cano')
    await user.click(screen.getByRole('checkbox'))

    await user.click(screen.getByRole('button', { name: '+ Agregar contacto' }))
    expect(screen.getByText('2 registrados · 2 sin guardar')).toBeInTheDocument()

    // El segundo borrador arranca sin principal, y marcarlo apaga al primero.
    const toggle = screen.getByRole('checkbox')
    expect(toggle).not.toBeChecked()
    await user.click(toggle)

    const drafts = screen.getAllByText('sin guardar')
    expect(drafts).toHaveLength(2)

    await user.type(screen.getByPlaceholderText('Nombre y apellidos'), 'Ana Ruiz')
    await user.click(screen.getByRole('button', { name: 'Agregar 2 contactos' }))

    // Volver al primero: perdió el principal al dárselo al segundo.
    await waitFor(() => {
      expect(screen.queryByText('El nombre es obligatorio')).not.toBeInTheDocument()
    })
    const first = screen.getAllByRole('button', { name: /Luis Cano/ })[0]
    await user.click(first as HTMLElement)
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('el aviso del índice único explica por qué no es un UPDATE cualquiera', () => {
    renderDialog()

    const notice = screen.getByText('Solo puede haber un principal por hotel.').closest('p')
    expect(within(notice as HTMLElement).getByText(/ux_hotel_contact_primary/)).toBeInTheDocument()
  })
})
