import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { RequisitionDetailPage } from './RequisitionDetailPage'

import { store } from '@/app/store'

function renderDetail(requisitionId = 'req-0001'): void {
  const router = createMemoryRouter(
    [{ path: '/requisiciones/:requisitionId', element: <RequisitionDetailPage /> }],
    { initialEntries: [`/requisiciones/${requisitionId}`] },
  )

  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('RequisitionDetailPage', () => {
  it('encabeza con el folio, su estado y quién la creó', async () => {
    renderDetail()

    expect(await screen.findByRole('heading', { name: '202608120930·K7' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Hotel Xcaret Arte · Ama de llaves · creada por Laura Méndez el 12 ago 2026 09:30',
      ),
    ).toBeInTheDocument()
  })

  it('los totales vienen del backend aunque los slots estén en la respuesta', async () => {
    renderDetail()

    // 4 de 7 son 57.14 %: se muestra el número de la API, redondeado al pintar.
    expect(await screen.findByText('7 · 4 ocupados')).toBeInTheDocument()
    expect(screen.getByText('57%')).toBeInTheDocument()
    expect(screen.getByText('Marcela Cruz')).toBeInTheDocument()
    expect(screen.getByText('Ricardo Solís')).toBeInTheDocument()
  })

  it('cada posición lleva su cobertura y su urgencia, que no son la misma cosa', async () => {
    renderDetail()

    expect(await screen.findByText('Parcial 3/4')).toBeInTheDocument()
    expect(screen.getByText('Cubierta 1/1')).toBeInTheDocument()
    expect(screen.getByText('Sin cubrir 0/2')).toBeInTheDocument()

    // Dos posiciones arrancan el 18 y una el 20: por eso hay dos urgencias.
    expect(screen.getAllByText('< 72 h')).toHaveLength(2)
    expect(screen.getByText('72 – 120 h')).toBeInTheDocument()
    expect(screen.getByText('Nómina')).toBeInTheDocument()
  })

  it('abre con los slots de la primera posición y cambia al elegir otra', async () => {
    const user = userEvent.setup()
    renderDetail()

    expect(await screen.findByText('Slots de la posición 1 · Camarista')).toBeInTheDocument()
    expect(screen.getByText('Ana Rivera Gómez')).toBeInTheDocument()
    expect(screen.getByText('Asignado 12 ago 10:02')).toBeInTheDocument()
    expect(screen.getAllByText('occupied')).toHaveLength(3)
    expect(screen.getByText('Visible en la Bolsa · Self-Pick')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Housekeeper' }))

    expect(screen.getByText('Slots de la posición 3 · Housekeeper')).toBeInTheDocument()
    expect(screen.getAllByText('Sin asignar')).toHaveLength(2)
    expect(screen.queryByText('Ana Rivera Gómez')).not.toBeInTheDocument()
  })

  it('la historia va de lo más nuevo a lo más viejo y marca dónde nace', async () => {
    renderDetail()

    const history = (await screen.findByText('Historia de estado')).closest('section')
    expect(history).not.toBeNull()

    const entries = within(history as HTMLElement).getAllByRole('listitem')

    // El asiento más nuevo va primero: «En elaboración → Autorizada», y el
    // nombre del estado destino sale dos veces, como chip y como título.
    expect(within(entries[0] as HTMLElement).getByText('En elaboración')).toBeInTheDocument()
    expect(within(entries[0] as HTMLElement).getAllByText('Autorizada')).toHaveLength(2)
    expect(within(entries[1] as HTMLElement).getByText('Creada')).toBeInTheDocument()

    // El alta no tiene estado de origen: nace en «En elaboración», no llega a él.
    expect(within(entries[1] as HTMLElement).getByText('nace en')).toBeInTheDocument()
    expect(within(entries[1] as HTMLElement).getAllByText('En elaboración')).toHaveLength(1)
  })

  it('no salta pasos del semáforo: a cubierta totalmente se llega por en proceso', async () => {
    renderDetail('req-0002')

    const history = (await screen.findByText('Historia de estado')).closest('section')
    const entries = within(history as HTMLElement).getAllByRole('listitem')

    // §5 no permite VERDE -> AZUL_CLARO directo; la historia pasa por AMARILLO.
    expect(entries).toHaveLength(4)
    expect(within(entries[0] as HTMLElement).getByText('Cobertura completada')).toBeInTheDocument()
    expect(within(entries[1] as HTMLElement).getByText('Puesta en proceso')).toBeInTheDocument()
  })
})
