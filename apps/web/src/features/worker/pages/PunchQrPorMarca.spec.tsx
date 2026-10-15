import { I18nProvider } from '@lingui/react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { hotelSimulado, limpiarPonchesSimulados, registerWorkerMocks } from '../api/workerMocks'

import { PunchPage } from './PunchPage'

import { baseApi } from '@/app/baseApi'
import { i18n } from '@/app/i18n'
import { store } from '@/app/store'

const SLOW = { timeout: 4000 }
const CODIGO = 'hotel-1.secreto-vigente'

/**
 * Cada marca con evidencia abre el lector del QR, sin excepción y sin
 * importar cómo se llegó a la pantalla (decisión de Hugo, 2026-10-14).
 *
 * Antes el código que trae la liga del QR impreso se guardaba toda la jornada
 * y se reusaba, así que la Salida se registraba con el QR leído en la Entrada
 * y el QR dejaba de probar que la persona seguía en el hotel al salir. Y dos
 * personas del mismo hotel veían cosas distintas: a quien abrió la app
 * escaneando la hoja nunca se le volvía a pedir, a quien entró por el menú sí.
 */
function renderPunch(entrada: string): ReturnType<typeof createMemoryRouter> {
  const router = createMemoryRouter([{ path: '/punch', element: <PunchPage /> }], {
    initialEntries: [entrada],
  })
  render(
    <I18nProvider i18n={i18n}>
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    </I18nProvider>,
  )
  return router
}

/**
 * El intro «una sola vez» de Ponchar se muestra encima de la pantalla y Radix
 * pone `aria-hidden` en el resto mientras está abierto: hay que cerrarlo antes
 * de poder leer o tocar nada (mismo patrón que los demás specs con intro).
 */
async function cerrarIntro(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const saltar = await screen.findByRole('button', { name: /Saltar/i }, SLOW)
  await user.click(saltar)
}

/**
 * El lector está abierto. `findAllBy` porque el lector y la pista del botón
 * nombran los dos al QR, y lo que importa es que el lector esté ahí, no
 * cuántas veces se menciona.
 */
async function elLectorEstaAbierto(): Promise<void> {
  const lector = await screen.findAllByText(/Escanea el QR del acceso/, undefined, SLOW)
  expect(lector.length).toBeGreaterThan(0)
}

describe('el QR del ponche se pide en cada marca', () => {
  beforeEach(() => {
    registerWorkerMocks()
    limpiarPonchesSimulados()
    /* La caché de RTK vive en el store compartido: sin limpiarla, un caso ve
       el timesheet que dejó el anterior y «la marca que sigue» ya no es la
       Entrada (mismo patrón que HomePage.spec). */
    store.dispatch(baseApi.util.resetApiState())
    hotelSimulado.punchMethod = 'QR'
    /* jsdom no trae geolocalización y el ponche no se registra sin ubicación
       (D-08: la geocerca la calcula el servidor con lo que le manda la app). */
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (ok: PositionCallback) => {
          ok({ coords: { latitude: 21.16, longitude: -86.8 } } as unknown as GeolocationPosition)
        },
      },
    })
  })

  afterEach(() => {
    hotelSimulado.punchMethod = 'SELFIE'
    vi.restoreAllMocks()
  })

  it('abre el lector aunque se haya llegado con la hoja ya escaneada', async () => {
    renderPunch(`/punch?qr=${encodeURIComponent(CODIGO)}`)
    const user = userEvent.setup()
    await cerrarIntro(user)

    /* La pista del botón no promete un atajo: siempre se escanea. */
    expect(await screen.findByText(/escaneando el QR del acceso/, undefined, SLOW)).toBeVisible()

    await user.click(screen.getByRole('button', { name: /Ponchar entrada/i }))

    await elLectorEstaAbierto()
  })

  it('el código de la liga no se queda en la dirección', async () => {
    const router = renderPunch(`/punch?qr=${encodeURIComponent(CODIGO)}`)
    const user = userEvent.setup()
    await cerrarIntro(user)

    /* Es el secreto del hotel: no tiene por qué quedarse en el historial del
       navegador, ni viajar si alguien comparte la dirección. */
    await waitFor(() => {
      expect(router.state.location.search).not.toContain('qr=')
    }, SLOW)
  })

  it('abre el lector también cuando se entró por el menú, sin código', async () => {
    renderPunch('/punch')
    const user = userEvent.setup()
    await cerrarIntro(user)

    await user.click(screen.getByRole('button', { name: /Ponchar entrada/i }))

    await elLectorEstaAbierto()
  })
})
