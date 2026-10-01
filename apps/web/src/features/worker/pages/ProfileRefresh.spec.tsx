import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { profile } from '../api/workerMocks'

import { HomePage } from './HomePage'

import { baseApi } from '@/app/baseApi'
import { store } from '@/app/store'

/**
 * Reportado por Hugo el 2026-10-01: el aviso de documento rechazado «no lo
 * muestra inmediatamente, tienes que presionar cargar».
 *
 * La causa no era el aviso. A su documento lo rechaza RECLUTAMIENTO, en otro
 * navegador, así que nada invalida la caché de la app del Colaborador y se
 * seguía sirviendo la ficha vieja. Lo que se prueba aquí es el remedio
 * —volver al frente vuelve a pedir la ficha— y se prueba moviendo la fixture
 * a media sesión, que es justo lo que pasa en producción.
 */
const SLOW = { timeout: 4000 }

afterEach(() => {
  profile.taxDeadline.wasRejected = false
  profile.taxDeadline.rejectionReason = null
  store.dispatch(baseApi.util.resetApiState())
})

describe('la ficha del Colaborador se refresca sola', () => {
  it('el rechazo hecho en otro navegador aparece al volver al frente', async () => {
    const router = createMemoryRouter([{ path: '/collaborator', element: <HomePage /> }], {
      initialEntries: ['/collaborator'],
    })
    render(
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>,
    )
    // La intro tapa la pantalla con aria-hidden: se cierra antes de aseverar.
    fireEvent.click(await screen.findByText('Saltar'))

    // Con la ficha ya cargada y sin rechazo, el aviso no está.
    expect(await screen.findByText('Faltan datos tuyos')).toBeInTheDocument()
    expect(screen.queryByText(/fue rechazado/i)).not.toBeInTheDocument()

    // Reclutamiento rechaza el documento, en SU navegador.
    profile.taxDeadline.wasRejected = true
    profile.taxDeadline.rejectionReason = 'La foto está borrosa'

    // Nadie avisó a esta app: sin tocar nada, el aviso sigue sin estar.
    expect(screen.queryByText(/fue rechazado/i)).not.toBeInTheDocument()

    // La persona vuelve a la app — el teléfono estuvo en el bolsillo.
    fireEvent.focus(window)

    // Y el aviso aparece con su motivo, sin recargar a mano.
    await waitFor(() => expect(screen.getByText(/fue rechazado/i)).toBeInTheDocument(), SLOW)
    expect(screen.getByText('La foto está borrosa')).toBeInTheDocument()
  })
})
