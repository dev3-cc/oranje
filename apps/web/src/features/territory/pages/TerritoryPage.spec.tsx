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
function renderTerritory(initialEntry = '/mi-territorio'): ReturnType<typeof createMemoryRouter> {
  const router = createMemoryRouter([{ path: '/mi-territorio', element: <TerritoryPage /> }], {
    initialEntries: [initialEntry],
  })

  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )

  return router
}

const SEARCH_LABEL = 'Buscar hotel en mi territorio'

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

  it('la búsqueda entra por la URL, y la URL sigue a la búsqueda', async () => {
    const router = renderTerritory('/mi-territorio?q=carmen')

    expect(screen.getByLabelText(SEARCH_LABEL)).toHaveValue('carmen')
    expect((await screen.findAllByText('Suites del Carmen')).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(screen.queryAllByText('Hotel Puerto Real')).toHaveLength(0)
    })

    await userEvent.clear(screen.getByLabelText(SEARCH_LABEL))
    await userEvent.type(screen.getByLabelText(SEARCH_LABEL), 'puerto')
    await waitFor(() => {
      expect(router.state.location.search).toBe('?q=puerto')
    })
    expect((await screen.findAllByText('Hotel Puerto Real')).length).toBeGreaterThan(0)
  })

  it('«Quitar filtros» limpia búsqueda y zona, y la búsqueda se va de la URL', async () => {
    const router = renderTerritory('/mi-territorio?q=carmen')
    await screen.findAllByText('Suites del Carmen')

    await userEvent.click(screen.getByRole('button', { name: /^Sur\s*\d+$/ }))
    expect(screen.getByRole('button', { name: /Quitar filtros/ })).toHaveTextContent('2')

    await userEvent.click(screen.getByRole('button', { name: /Quitar filtros/ }))
    expect(screen.getByLabelText(SEARCH_LABEL)).toHaveValue('')
    expect(screen.queryByRole('button', { name: /Quitar filtros/ })).not.toBeInTheDocument()
    expect((await screen.findAllByText('Hotel Puerto Real')).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(router.state.location.search).toBe('')
    })
  })

  it('sin API key explica qué falta en vez de dejar el mapa roto', async () => {
    renderTerritory()

    // El entorno de prueba no define VITE_GOOGLE_MAPS_API_KEY.
    expect(await screen.findByText('Falta la API key de Google Maps')).toBeInTheDocument()
  })
})
