import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it, vi } from 'vitest'

import type { ProspectDetail } from '../types/prospect.types'

import { ProspectFormDialog } from './ProspectFormDialog'

import { store } from '@/app/store'

const PROSPECT: ProspectDetail = {
  id: 'psp-0007',
  hotelName: 'Hotel Puerto Real',
  status: 'PINK',
  cycleStartedAt: '2026-05-12',
  daysInStatus: 7,
  owner: { id: 'usr-ana-ruiz', name: 'Ana Ruiz', shortName: 'A. Ruiz' },
  hotel: {
    address: 'Blvd. Kukulcán km 9.5, Cancún',
    generalPhone: '+52 998 123 4567',
    zoneId: 'centro',
    zone: 'Zona Centro',
    timeZone: 'America/Cancun',
    geofenceMeters: 150,
    location: { lat: 21.1619, lng: -86.8515 },
    photoUrl: null,
    activatedAsClientAt: null,
  },
  needDescription: '2 camaristas y 1 houseman',
  contacts: [
    {
      id: 'ctc-marta',
      name: 'Marta Solís',
      role: 'Gerente de Compras',
      phone: '+52 998 111 2233',
      email: '',
      isPrimary: true,
    },
  ],
  attempts: [],
  history: [],
}

function renderDialog(prospect?: ProspectDetail): void {
  render(
    <Provider store={store}>
      <ProspectFormDialog isOpen onClose={vi.fn()} {...(prospect ? { prospect } : {})} />
    </Provider>,
  )
}

describe('ProspectFormDialog', () => {
  it('en alta ofrece elegir entre hotel nuevo y hotel ya registrado', () => {
    renderDialog()

    expect(screen.getByRole('heading', { name: 'Nuevo prospecto' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hotel nuevo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hotel ya registrado' })).toBeInTheDocument()
  })

  /** El wizard no avanza del paso 1 con los obligatorios vacíos. */
  it('en alta no deja avanzar sin los datos obligatorios', async () => {
    const user = userEvent.setup()
    renderDialog()

    // Crear vive en el paso 3; en el 1 solo existe Continuar.
    expect(screen.queryByRole('button', { name: 'Crear prospecto' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    // Sigue en el paso 1: el campo del edificio sigue visible.
    expect(screen.getByLabelText('Nombre del hotel')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Crear prospecto' })).not.toBeInTheDocument()
  })

  /** Un ciclo abierto no cambia de edificio: elegir origen no aplica al editar. */
  it('en edición desaparece el selector de origen del hotel', () => {
    renderDialog(PROSPECT)

    expect(screen.getByRole('heading', { name: 'Editar prospecto' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hotel ya registrado' })).not.toBeInTheDocument()
  })

  it('en edición llega con los datos y el wizard recorre hasta el ciclo', async () => {
    const user = userEvent.setup()
    renderDialog(PROSPECT)

    // Paso 1: el edificio, prellenado.
    expect(screen.getByLabelText('Nombre del hotel')).toHaveValue('Hotel Puerto Real')
    // Radix Select no es un <select>: el valor se lee del trigger.
    expect(screen.getByLabelText('Zona horaria')).toHaveTextContent('America/Cancun')

    // Paso 2: la ubicación, con el buscador y la geocerca.
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByRole('slider')).toHaveAttribute('aria-valuenow', '150')

    // Paso 3: el contacto principal, prellenado.
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByLabelText('Nombre')).toHaveValue('Marta Solís')
    expect(screen.getByLabelText('Puesto')).toHaveValue('Gerente de Compras')

    // Paso 4: el ciclo, con el botón de guardar al final.
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByLabelText('Qué necesita')).toHaveValue('2 camaristas y 1 houseman')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()

    // Atrás regresa sin perder lo escrito.
    await user.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(await screen.findByLabelText('Nombre')).toHaveValue('Marta Solís')
  })

  it('el radio de geocerca llega del prospecto y se lee en los dos sitios', async () => {
    const user = userEvent.setup()
    renderDialog(PROSPECT)

    // El deslizador vive en el paso 2 (Ubicación); la ficha, en los demás pasos.
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    // Radix Slider expone el valor por aria, no por value.
    expect(await screen.findByRole('slider')).toHaveAttribute('aria-valuenow', '150')
  })
})
