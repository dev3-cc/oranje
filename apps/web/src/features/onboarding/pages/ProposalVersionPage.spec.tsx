import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ProposalVersionPage } from './ProposalVersionPage'

import { store } from '@/app/store'

function renderVersion(prospectId: string, version: string): void {
  const router = createMemoryRouter(
    [{ path: '/propuestas/:prospectId/:version', element: <ProposalVersionPage /> }],
    { initialEntries: [`/propuestas/${prospectId}/${version}`] },
  )

  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('ProposalVersionPage', () => {
  it('abre la versión pedida por la URL, no la vigente', async () => {
    // Hotel Mirador tiene la v3 en borrador; se pide la v1, ya enviada.
    renderVersion('psp-0008', '1')

    expect(await screen.findByText('Propuesta v1 · Hotel Mirador')).toBeInTheDocument()
    expect(screen.getByText('Enviada 21 may 2026 · Ana Ruiz')).toBeInTheDocument()
    expect(screen.getByText('Housekeeping para temporada alta.')).toBeInTheDocument()
  })

  it('calcula el margen de esa versión', async () => {
    renderVersion('psp-0008', '1')

    // v1 se envió con pay 170 / bill 250: margen de 80, el 32 % del bill.
    expect(await screen.findByText('$170.00')).toBeInTheDocument()
    expect(screen.getByText('$250.00')).toBeInTheDocument()
    expect(screen.getByText('$80.00 · 32.0%')).toBeInTheDocument()
  })

  it('el borrador se marca como no enviado', async () => {
    renderVersion('psp-0008', '3')

    expect(
      await screen.findByText('Borrador sin enviar · sent_at es NULL hasta enviarla'),
    ).toBeInTheDocument()
  })

  it('una versión inexistente no revienta la pantalla', async () => {
    renderVersion('psp-0008', '99')

    expect(
      await screen.findByText('No se encontró esa versión de la propuesta.'),
    ).toBeInTheDocument()
  })
})
