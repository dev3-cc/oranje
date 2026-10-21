import { I18nProvider } from '@lingui/react'
import { render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LoginPage } from './LoginPage'

import { baseApi } from '@/app/baseApi'
import { i18n } from '@/app/i18n'
import { store } from '@/app/store'

const SLOW = { timeout: 4000 }

/**
 * La prueba del componente suelto no alcanza: lo que importa es que el modal
 * salga EN EL LOGIN de verdad, montado donde quedó. Un componente correcto
 * puesto dentro de una rama que no se dibuja se ve igual de roto que uno mal
 * escrito, y la prueba aislada no lo nota.
 *
 * Hugo no lo veía en staging y la causa era la correcta —su navegador ya tiene
 * idioma guardado, porque `sessionApi` lo guarda al iniciar sesión— pero eso
 * no probaba que funcionara sin preferencia. Esto sí.
 */
function simularAlmacenamiento(inicial: Record<string, string> = {}): void {
  const datos = new Map(Object.entries(inicial))
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => datos.set(k, v),
    removeItem: (k: string) => datos.delete(k),
    clear: () => datos.clear(),
    key: () => null,
    length: 0,
  })
}

function renderLogin(): void {
  const router = createMemoryRouter([{ path: '/login', element: <LoginPage /> }], {
    initialEntries: ['/login'],
  })
  render(
    <I18nProvider i18n={i18n}>
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    </I18nProvider>,
  )
}

describe('el login pregunta el idioma', () => {
  beforeEach(() => {
    store.dispatch(baseApi.util.resetApiState())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sale sobre el formulario cuando nadie ha elegido nunca', async () => {
    simularAlmacenamiento()

    renderLogin()

    /* Montado en la página real, no en un contenedor de prueba. */
    expect(await screen.findByText(/Elige tu idioma/, undefined, SLOW)).toBeVisible()
    expect(screen.getByRole('button', { name: /English/ })).toBeVisible()
  })

  it('no sale para quien ya entró alguna vez', async () => {
    /* `sessionApi` guarda el idioma de la persona al iniciar sesión, así que
       cualquiera que haya entrado una vez ya tiene preferencia. Ese es el caso
       normal y el modal no debe aparecerle. */
    simularAlmacenamiento({ 'oranje-locale': 'es' })

    renderLogin()

    /* El formulario sí se montó —`toBeInTheDocument` y no `toBeVisible`: la
       animación de entrada lo deja en opacidad 0 al principio, que no es lo
       que este caso mide—. Lo que importa es que el modal NO esté. */
    expect(await screen.findByLabelText(/Correo/i, undefined, SLOW)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText(/Elige tu idioma/)).not.toBeInTheDocument()
    })
  })
})
