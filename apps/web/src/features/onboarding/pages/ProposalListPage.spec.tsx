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

    const link = await screen.findByRole('link', { name: /Hotel Mirador/ })
    expect(link).toHaveAttribute('href', '/pipeline/psp-0008/propuesta')
  })

  it('distingue el borrador abierto de la última enviada', async () => {
    renderList()

    await screen.findByRole('link', { name: /Hotel Mirador/ })

    // Hotel Mirador tiene la v3 en borrador; Puerto Real cerró con la v2.
    expect(screen.getByText('Borrador sin enviar')).toBeInTheDocument()
    expect(screen.getAllByText(/^Enviada /).length).toBeGreaterThan(0)
  })

  it('solo lista hoteles con propuesta, no todos los prospectos', async () => {
    renderList()

    await screen.findByRole('link', { name: /Hotel Mirador/ })

    // Hotel Riviera Maya está en el pipeline pero nunca se le cotizó.
    expect(screen.queryByText('Hotel Riviera Maya')).not.toBeInTheDocument()
  })
})
