import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { TerritoryPage } from './TerritoryPage'

import { store } from '@/app/store'

/**
 * La pantalla ya no tiene endpoint propio: COMPONE `/me` + `/users/:id/zones` +
 * `/hotels` + `/prospects`, así que estas pruebas cubren la cadena completa
 * sobre los fixtures de Onboarding. Algunos nombres aparecen DOS veces a
 * propósito: los fixtures repiten cinco hoteles como prospecto abierto y como
 * cliente convertido (ver el aviso en `onboardingMocks.ts`).
 */
function renderTerritory(): void {
  const router = createMemoryRouter([{ path: '/mi-territorio', element: <TerritoryPage /> }], {
    initialEntries: ['/mi-territorio'],
  })

  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('TerritoryPage', () => {
  it('lista los hoteles del territorio con su zona', async () => {
    renderTerritory()

    expect((await screen.findAllByText('Hotel Puerto Real')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Grand Costa Nube').length).toBeGreaterThan(0)
    expect(screen.getByText('Hotel Riviera Maya')).toBeInTheDocument()
  })

  it('un cliente activo muestra desde cuándo lo es, no días en estado', async () => {
    renderTerritory()

    // Los convertidos (NARANJA) traen fecha de alta, no días en estado.
    expect((await screen.findAllByText(/Cliente desde/)).length).toBeGreaterThan(0)
  })

  it('filtrar por zona deja solo los hoteles de esa zona', async () => {
    renderTerritory()
    await screen.findAllByText('Hotel Puerto Real')

    await userEvent.click(screen.getByRole('button', { name: /^Sur\s*\d+$/ }))

    expect((await screen.findAllByText('Suites del Carmen')).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(screen.queryAllByText('Hotel Puerto Real')).toHaveLength(0)
    })
  })

  it('sin API key explica qué falta en vez de dejar el mapa roto', async () => {
    renderTerritory()

    // El entorno de prueba no define VITE_GOOGLE_MAPS_API_KEY.
    expect(await screen.findByText('Falta la API key de Google Maps')).toBeInTheDocument()
  })
})
