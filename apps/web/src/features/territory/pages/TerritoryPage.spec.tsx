import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { TerritoryPage } from './TerritoryPage'

import { store } from '@/app/store'

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

    expect(await screen.findByText('Hotel Puerto Real')).toBeInTheDocument()
    expect(screen.getByText('Grand Costa Nube')).toBeInTheDocument()
    expect(screen.getByText('Hostal Del Sol')).toBeInTheDocument()
  })

  it('un cliente activo muestra desde cuándo lo es, no días en estado', async () => {
    renderTerritory()

    // Hotel Vista Laguna está en NARANJA.
    expect(await screen.findByText('Cliente desde 08 jul')).toBeInTheDocument()
  })

  it('filtrar por zona deja solo los hoteles de esa zona', async () => {
    renderTerritory()
    await screen.findByText('Hotel Puerto Real')

    await userEvent.click(screen.getByRole('button', { name: /^Sur\s*13$/ }))

    expect(await screen.findByText('Suites del Carmen')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('Hotel Puerto Real')).not.toBeInTheDocument()
    })
  })

  it('sin API key explica qué falta en vez de dejar el mapa roto', async () => {
    renderTerritory()

    // El entorno de prueba no define VITE_GOOGLE_MAPS_API_KEY.
    expect(await screen.findByText('Falta la API key de Google Maps')).toBeInTheDocument()
  })
})
