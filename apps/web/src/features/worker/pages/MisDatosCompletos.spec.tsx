import { I18nProvider } from '@lingui/react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { profile, registerWorkerMocks } from '../api/workerMocks'

import { Phase2Page } from './Phase2Page'

import { baseApi } from '@/app/baseApi'
import { i18n } from '@/app/i18n'
import { store } from '@/app/store'

const SLOW = { timeout: 4000 }

/**
 * «Mis datos» no debe verse como una tarea pendiente cuando ya no falta nada.
 *
 * La pestaña abría SIEMPRE el asistente de alta desde el paso 1, hubiera o no
 * algo que llenar, así que quien ya había terminado seguía viendo un
 * formulario de alta y creía que le faltaba algo (Hugo lo vio en producción,
 * 2026-10-16).
 *
 * Lo que decide si está completo es el TRANSPORTE y el DOCUMENTO FISCAL. La
 * foto no: es opcional y queda fuera del perfil completo a propósito, así que
 * contarla dejaría la pantalla en «pendiente» para siempre.
 */
function renderMisDatos(): void {
  const router = createMemoryRouter([{ path: '/', element: <Phase2Page /> }], {
    initialEntries: ['/'],
  })
  render(
    <I18nProvider i18n={i18n}>
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    </I18nProvider>,
  )
}

describe('Mis datos del colaborador', () => {
  beforeEach(() => {
    registerWorkerMocks()
    store.dispatch(baseApi.util.resetApiState())
  })

  afterEach(() => {
    profile.transportType = null
    profile.taxDeadline.hasDocument = false
    profile.taxDeadline.isDocumentVerified = false
  })

  it('con todo lleno muestra el resumen, no el asistente', async () => {
    profile.transportType = 'OWN'
    profile.taxDeadline.hasDocument = true

    renderMisDatos()

    expect(await screen.findByText('Ya está todo', undefined, SLOW)).toBeVisible()
    /* Lo que de verdad importa: no se ve el formulario de alta. */
    expect(screen.queryByText('Elige tu transporte para continuar')).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Sigues en Blanco hasta que la Reclutadora valide/),
    ).not.toBeInTheDocument()
  })

  it('desde el resumen se puede entrar a corregir', async () => {
    profile.transportType = 'OWN'
    profile.taxDeadline.hasDocument = true

    renderMisDatos()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Corregir mis datos/i }, SLOW))

    /* El asistente vuelve, en el primer paso. */
    expect(await screen.findByText('Paso 1 de 3', undefined, SLOW)).toBeVisible()
  })

  it('si falta el transporte sigue mostrando el asistente', async () => {
    profile.taxDeadline.hasDocument = true

    renderMisDatos()

    expect(await screen.findByText('Paso 1 de 3', undefined, SLOW)).toBeVisible()
    expect(screen.queryByText('Ya está todo')).not.toBeInTheDocument()
  })

  it('si falta el documento fiscal sigue mostrando el asistente', async () => {
    profile.transportType = 'OWN'

    renderMisDatos()

    expect(await screen.findByText('Paso 1 de 3', undefined, SLOW)).toBeVisible()
    expect(screen.queryByText('Ya está todo')).not.toBeInTheDocument()
  })
})
