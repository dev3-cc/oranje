import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { notifications } from '../api/workerMocks'

import { NotificationsPage } from './NotificationsPage'

import { baseApi } from '@/app/baseApi'
import { store } from '@/app/store'

/**
 * Censo del 2026-10-01: un aviso lo genera OTRA persona, en otro navegador,
 * así que ninguna invalidación de etiqueta llega hasta aquí. La campana se
 * quedaba congelada toda la sesión — y con ella la lógica de «suena cuando el
 * contador sube» del Header, que no podía dispararse nunca.
 *
 * Esto prueba que ya no: el aviso se empuja a la fixture a media sesión, que
 * es como llega de verdad.
 */
const SLOW = { timeout: 4000 }
const ORIGINALES = notifications.length

afterEach(() => {
  notifications.length = ORIGINALES
  store.dispatch(baseApi.util.resetApiState())
})

describe('la campana no se queda congelada', () => {
  it('un aviso que llegó mientras trabajabas aparece al volver al frente', async () => {
    const router = createMemoryRouter([{ path: '/', element: <NotificationsPage /> }], {
      initialEntries: ['/'],
    })
    render(
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>,
    )

    await waitFor(() => expect(screen.getByText('Completa tu alta')).toBeInTheDocument(), SLOW)
    expect(screen.queryByText('Documento rechazado')).not.toBeInTheDocument()

    // Reclutamiento rechaza el documento: el aviso nace en SU navegador.
    notifications.unshift({
      id: 'ntf-nuevo',
      type: { code: 'DOCUMENT_REJECTED', name: 'Documento rechazado', module: 'recruitment' },
      title: 'Documento rechazado',
      body: 'Tu SSN/ITIN no pasó la revisión: la foto está borrosa.',
      entity: { type: 'personal.worker_document', id: 'doc-1' },
      actor: null,
      createdAt: new Date().toISOString(),
      readAt: null,
    })

    // Nadie avisó a esta pantalla: sin tocar nada, todavía no está.
    expect(screen.queryByText('Documento rechazado')).not.toBeInTheDocument()

    // La persona vuelve a la app.
    fireEvent.focus(window)

    await waitFor(() => expect(screen.getByText('Documento rechazado')).toBeInTheDocument(), SLOW)
  })
})
