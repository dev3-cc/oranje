import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { HomePage } from './HomePage'

import { store } from '@/app/store'

/** El fixture nace en BLANCO: sin expediente completo y sin poder encender Amarillo. */
function renderHome(): void {
  const router = createMemoryRouter([{ path: '/colaborador', element: <HomePage /> }], {
    initialEntries: ['/colaborador'],
  })
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('HomePage del Colaborador', () => {
  it('saluda por nombre y enseña el estado del semáforo en palabras', async () => {
    renderHome()

    expect(await screen.findByRole('heading', { name: /Hola, / })).toBeInTheDocument()
    expect(screen.getByText(/Pre-asignación/)).toBeInTheDocument()
  })

  it('con el expediente incompleto ofrece terminarlo, y en Blanco no enciende Amarillo', async () => {
    renderHome()

    expect(await screen.findByText('Tu expediente está incompleto')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marcarme disponible' })).not.toBeInTheDocument()
    expect(screen.getByText(/la maneja Reclutamiento/)).toBeInTheDocument()
  })
})
