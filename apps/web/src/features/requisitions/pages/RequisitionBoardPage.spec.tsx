import { render, screen, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { RequisitionBoardPage } from './RequisitionBoardPage'

import { store } from '@/app/store'

function renderBoard(): void {
  const router = createMemoryRouter(
    [{ path: '/requisiciones', element: <RequisitionBoardPage /> }],
    {
      initialEntries: ['/requisiciones'],
    },
  )

  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('RequisitionBoardPage', () => {
  it('resume el territorio con las cifras del backend, no contando filas', async () => {
    renderBoard()

    // Se pintan 6 filas pero el encabezado habla de 8 abiertas: son cosas distintas.
    expect(
      await screen.findByText('8 abiertas · 3 esperan autorización · 2 urgentes'),
    ).toBeInTheDocument()
    expect(screen.getByText('en 4 hoteles')).toBeInTheDocument()
    expect(screen.getByText('12 slots libres')).toBeInTheDocument()
    expect(screen.getByText('RR-H-05')).toBeInTheDocument()
  })

  it('traduce el semáforo de Requisición a lo que el color significa aquí', async () => {
    renderBoard()

    // Los mismos colores que en Onboarding, con otro significado.
    expect(await screen.findByText('En elaboración')).toBeInTheDocument()
    expect(screen.getByText('En proceso')).toBeInTheDocument()

    // «Autorizada» es también el nombre de una columna: se busca en su fila.
    const row = screen.getByText('202608120930·K7').closest('tr')
    expect(within(row as HTMLElement).getByText('Autorizada')).toBeInTheDocument()

    expect(screen.getAllByText('Cubierta totalmente')).toHaveLength(2)
    expect(screen.getByText('Eliminada')).toBeInTheDocument()
  })

  it('la cobertura dice en palabras si está cubierta, parcial o sin cubrir', async () => {
    renderBoard()

    expect(await screen.findByText('4/7')).toBeInTheDocument()
    expect(screen.getAllByText('parcial')).toHaveLength(2)
    expect(screen.getAllByText('cubierta')).toHaveLength(2)
    expect(screen.getAllByText('sin cubrir')).toHaveLength(2)
  })

  it('una requisición sin autorizar no inventa fecha', async () => {
    renderBoard()

    const row = (await screen.findByText('202608121115·M9')).closest('tr')
    expect(row).not.toBeNull()
    expect(within(row as HTMLElement).getByText('—')).toBeInTheDocument()
  })

  it('«Por autorizar» es la única métrica que lleva a algún lado', async () => {
    renderBoard()

    expect(await screen.findByRole('link', { name: /Por autorizar/ })).toHaveAttribute(
      'href',
      '/requisiciones/autorizacion',
    )
    expect(screen.queryByRole('link', { name: /Urgentes/ })).not.toBeInTheDocument()
  })

  it('el folio lleva al detalle', async () => {
    renderBoard()

    expect(await screen.findByRole('link', { name: '202608120930·K7' })).toHaveAttribute(
      'href',
      '/requisiciones/req-0001',
    )
  })
})
