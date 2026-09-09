import { fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { HomePage } from './HomePage'

import { activateLocale } from '@/app/i18n'
import { store } from '@/app/store'

/**
 * D-36: la misma pantalla en inglés. El setup global fija español antes de
 * cada test; aquí se activa `en` después, y lo que se asevera es el catálogo
 * (`src/locales/en/messages.po`), no el componente — si un texto se queda sin
 * inglés, se vería en español y esta prueba lo atrapa.
 */
beforeEach(() => {
  activateLocale('en')
})

async function renderHome(): Promise<void> {
  const router = createMemoryRouter([{ path: '/colaborador', element: <HomePage /> }], {
    initialEntries: ['/colaborador'],
  })
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  fireEvent.click(await screen.findByText('Skip'))
}

describe('HomePage del Colaborador, in English', () => {
  it('greets, names the status light and asks for the missing info in English', async () => {
    await renderHome()

    expect(await screen.findByRole('heading', { name: /Hi, / })).toBeInTheDocument()
    expect(screen.getAllByText(/Pre-assignment/).length).toBeGreaterThan(0)
    expect(await screen.findByText('Some of your info is missing')).toBeInTheDocument()
    expect(screen.queryByText('Faltan datos tuyos')).not.toBeInTheDocument()
  })
})
