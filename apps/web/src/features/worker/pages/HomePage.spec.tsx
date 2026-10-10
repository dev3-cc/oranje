import { fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { profile } from '../api/workerMocks'

import { HomePage } from './HomePage'

import { baseApi } from '@/app/baseApi'
import { store } from '@/app/store'

/**
 * El fixture nace en BLANCO: sin expediente completo y sin poder encender
 * Amarillo. El onboarding se salta a mano: sin localStorage (jsdom) siempre
 * se muestra (fail-open del hook).
 */
async function renderHome(): Promise<void> {
  const router = createMemoryRouter([{ path: '/collaborator', element: <HomePage /> }], {
    initialEntries: ['/collaborator'],
  })
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  fireEvent.click(await screen.findByText('Saltar'))
}

describe('HomePage del Colaborador', () => {
  it('saluda por nombre y enseña el estado del semáforo en palabras', async () => {
    await renderHome()

    expect(await screen.findByRole('heading', { name: /Hola, / })).toBeInTheDocument()
    expect(screen.getAllByText(/Pre-asignación/).length).toBeGreaterThan(0)
  })

  it('con el expediente incompleto ofrece terminarlo, y en Blanco no ofrece disponibilidad', async () => {
    await renderHome()

    expect(await screen.findByText('Faltan datos tuyos')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marcarme disponible' })).not.toBeInTheDocument()
    expect(screen.queryByText('Disponibilidad')).not.toBeInTheDocument()
  })

  // Caso real de Hugo (2026-10-09): le reportan que llena sus fases y la app
  // «sigue pidiéndole». El aviso nombraba siempre las mismas tres cosas —y se
  // le olvidaba el tipo de sangre—, así que quien solo debía ese veía un texto
  // que le pedía justo lo que ya había hecho.
  it('nombra lo que de verdad falta, y aclara que la foto no cuenta', async () => {
    profile.transportType = 'PUBLIC'
    profile.emergencyContact = { name: 'Oscar', phone: '9983004532', relationship: 'FATHER' }
    profile.taxDeadline = { ...profile.taxDeadline, hasDocument: true }
    profile.bloodType = null
    profile.photoUrl = null
    profile.isProfileComplete = false
    store.dispatch(baseApi.util.resetApiState())

    await renderHome()

    await screen.findByText('Faltan datos tuyos')
    expect(screen.getByText(/Falta tu tipo de sangre/)).toBeInTheDocument()
    // Lo que ya hizo no se le vuelve a pedir.
    expect(screen.queryByText(/cómo llegas al trabajo/)).not.toBeInTheDocument()
    expect(screen.queryByText(/SSN o ITIN\./)).not.toBeInTheDocument()
    // Y la foto, que no entra en el perfil completo, se declara opcional.
    expect(screen.getByText(/Tu foto no hace falta/)).toBeInTheDocument()
  })

  // Caso real de Hugo (2026-09-29): terminó transporte, SSN/ITIN y contacto
  // de emergencia, y «Faltan datos tuyos» seguía ahí — `isProfileComplete`
  // también exige posición/modalidad/inglés/experiencia, que decide la
  // Reclutadora y su cuenta de prueba nunca tuvo. Sin eso, la tarjeta no se
  // apaga jamás aunque ya no le quede nada por hacer.
  it('con SU parte terminada, no invita a completar lo que decide la Reclutadora', async () => {
    profile.transportType = 'PUBLIC'
    profile.emergencyContact = { name: 'Oscar', phone: '9983004532', relationship: 'FATHER' }
    profile.bloodType = 'O_POS'
    profile.taxDeadline = { ...profile.taxDeadline, hasDocument: true }
    profile.isProfileComplete = false
    /* Las pruebas anteriores ya dejaron el perfil viejo en caché del store
       compartido: sin esto, este render lo serviría sin pedirlo de nuevo. */
    store.dispatch(baseApi.util.resetApiState())

    await renderHome()

    expect(await screen.findByRole('heading', { name: /Hola, / })).toBeInTheDocument()
    expect(screen.queryByText('Faltan datos tuyos')).not.toBeInTheDocument()
  })
})
