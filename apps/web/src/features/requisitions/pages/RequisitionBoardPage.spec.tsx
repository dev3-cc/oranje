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

    // Las métricas se calculan sobre el listado real completo (D-28).
    expect(
      await screen.findByText('8 abiertas · 3 esperan autorización · 2 urgentes'),
    ).toBeInTheDocument()
    expect(screen.getByText('en 5 hoteles')).toBeInTheDocument()
    expect(screen.getByText('26 slots libres')).toBeInTheDocument()
    expect(screen.getByText('RR-H-05')).toBeInTheDocument()
  })

  it('traduce el semáforo de Requisición a lo que el color significa aquí', async () => {
    renderBoard()

    // Los mismos colores que en Onboarding, con otro significado.
    expect((await screen.findAllByText('En elaboración')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('En proceso').length).toBeGreaterThan(0)

    // «Autorizada» es también el nombre de una columna: se busca en su fila.
    const row = screen.getByText('202608140700·E1').closest('tr')
    expect(within(row as HTMLElement).getByText('Autorizada')).toBeInTheDocument()
  })

  it('la cobertura dice en palabras si está cubierta, parcial o sin cubrir', async () => {
    renderBoard()

    expect(await screen.findByText('4/6')).toBeInTheDocument()
    expect(screen.getAllByText('parcial')).toHaveLength(4)
    expect(screen.getAllByText('sin cubrir').length).toBeGreaterThan(0)
  })

  it('una requisición sin autorizar no inventa fecha', async () => {
    renderBoard()

    const row = (await screen.findByText('202608190930·K7')).closest('tr')
    expect(row).not.toBeNull()
    // Dos rayas: la fecha que no existe y el inspector sin endpoint de nombre.
    expect(within(row as HTMLElement).getAllByText('—').length).toBeGreaterThan(0)
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
      '/requisiciones/req-0004',
    )
  })
})
