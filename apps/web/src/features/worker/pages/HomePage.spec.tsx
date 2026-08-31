import { fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { HomePage } from './HomePage'

import { store } from '@/app/store'

/**
 * El fixture nace en BLANCO: sin expediente completo y sin poder encender
 * Amarillo. El onboarding se salta a mano: sin localStorage (jsdom) siempre
 * se muestra (fail-open del hook).
 */
async function renderHome(): Promise<void> {
  const router = createMemoryRouter([{ path: '/colaborador', element: <HomePage /> }], {
    initialEntries: ['/colaborador'],
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
})
