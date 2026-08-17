import { render, screen } from '@testing-library/react'
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

  it('en alta no deja crear sin los datos obligatorios', () => {
    renderDialog()

    expect(screen.getByRole('button', { name: 'Crear prospecto' })).toBeDisabled()
  })

  /** Un ciclo abierto no cambia de edificio: elegir origen no aplica al editar. */
  it('en edición desaparece el selector de origen del hotel', () => {
    renderDialog(PROSPECT)

    expect(screen.getByRole('heading', { name: 'Editar prospecto' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hotel ya registrado' })).not.toBeInTheDocument()
  })

  it('en edición llega con los datos del prospecto, incluido el contacto principal', () => {
    renderDialog(PROSPECT)

    expect(screen.getByLabelText('Nombre del hotel')).toHaveValue('Hotel Puerto Real')
    expect(screen.getByLabelText('Zona horaria')).toHaveValue('America/Cancun')
    expect(screen.getByLabelText('Nombre')).toHaveValue('Marta Solís')
    expect(screen.getByLabelText('Puesto')).toHaveValue('Gerente de Compras')
    expect(screen.getByLabelText('Qué necesita')).toHaveValue('2 camaristas y 1 houseman')
  })

  it('el radio de geocerca llega del prospecto y se lee en los dos sitios', () => {
    renderDialog(PROSPECT)

    expect(screen.getByLabelText('Radio de geocerca')).toHaveValue('150')
    // Junto al deslizador y en el resumen de la derecha: tienen que coincidir.
    expect(screen.getAllByText('150 m')).toHaveLength(2)
  })
})
