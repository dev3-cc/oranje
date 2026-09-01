import { fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ProposalListPage } from './ProposalListPage'

import { store } from '@/app/store'

function renderList(): void {
  const router = createMemoryRouter([{ path: '/propuestas', element: <ProposalListPage /> }], {
    initialEntries: ['/propuestas'],
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
})
