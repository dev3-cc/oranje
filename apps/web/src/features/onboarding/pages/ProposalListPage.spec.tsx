import { render, screen } from '@testing-library/react'
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
  it('cada fila lleva al editor DENTRO del pipeline, no a una ruta propia', async () => {
    renderList()

    const links = await screen.findAllByRole('link', { name: /Hotel Mirador/ })
    expect(links.map((link) => link.getAttribute('href'))).toContain('/pipeline/psp-0008/propuesta')
  })

  it('distingue el borrador abierto de la última enviada', async () => {
    renderList()

    await screen.findAllByRole('link', { name: /Hotel Mirador/ })

    expect(screen.getByText('Borrador sin enviar')).toBeInTheDocument()
    expect(screen.getAllByText(/^Enviada /).length).toBeGreaterThan(0)
  })

  it('solo lista hoteles con propuesta, no todos los prospectos', async () => {
    renderList()

    await screen.findAllByRole('link', { name: /Hotel Mirador/ })

    expect(screen.queryByText('Hotel Riviera Maya')).not.toBeInTheDocument()
  })
})
