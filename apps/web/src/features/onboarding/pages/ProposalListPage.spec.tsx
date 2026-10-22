import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ProposalListPage } from './ProposalListPage'

import { store } from '@/app/store'

/* La búsqueda espera el debounce (300ms) + el mock: en la suite completa, con
   decenas de archivos corriendo a la vez, el default de 1s de `waitFor` no
   siempre alcanza — mismo criterio que ya usan otras pantallas con buscador. */
const SLOW = { timeout: 4000 }

function renderList(): void {
  const router = createMemoryRouter([{ path: '/proposals', element: <ProposalListPage /> }], {
    initialEntries: ['/proposals'],
  })

  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('ProposalListPage', () => {
  it('elegir un hotel abre su propuesta a la derecha, sin salir de la lista', async () => {
    renderList()

    const rows = await screen.findAllByRole('button', { name: /Hotel Mirador/ })
    fireEvent.click(rows[0] as HTMLElement)
    /* Título se retiró (2026-10-19): el encabezado siempre es el genérico. */
    expect(
      await screen.findByRole('heading', { name: /Propuesta · Hotel Mirador/ }),
    ).toBeInTheDocument()
  })

  it('distingue el borrador abierto de la última enviada', async () => {
    renderList()

    await screen.findAllByRole('button', { name: /Hotel Mirador/ })

    expect(screen.getAllByText(/Borrador sin enviar/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Enviada /).length).toBeGreaterThan(0)
  })

  it('solo lista hoteles con propuesta, no todos los prospectos', async () => {
    renderList()

    await screen.findAllByRole('button', { name: /Hotel Mirador/ })

    expect(screen.queryByRole('button', { name: /Hotel Riviera Maya/ })).not.toBeInTheDocument()
  })

  // Hugo, 2026-10-21: "necesitamos un buscador de hoteles... en las
  // propuestas" — va al servidor (`/prospects?search=`), como el Pool.
  it('el buscador por hotel filtra la lista', async () => {
    const user = userEvent.setup()
    renderList()

    await screen.findAllByRole('button', { name: /Hotel Mirador/ })

    await user.type(screen.getByLabelText('Buscar hotel'), 'Mirador')

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Hotel Puerto Real/ })).not.toBeInTheDocument()
    }, SLOW)
    // Más de uno: la fila de la lista Y el encabezado del detalle a la derecha.
    expect(screen.getAllByRole('button', { name: /Hotel Mirador/ }).length).toBeGreaterThan(0)
  })
})
