import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { RequisitionDetailPage } from './RequisitionDetailPage'

import { store } from '@/app/store'

/**
 * La ficha COMPONE el contrato real: `GET /requisitions/:id` + las
 * asignaciones de `coverage`. Los nombres de quién creó, autorizó o inspecciona
 * salen como `—`: el contrato solo da ids y su endpoint de nombres no existe
 * aún. `req-0005` (Villas Coral) es la autorizada con dos posiciones.
 */
function renderDetail(requisitionId = 'req-0005'): void {
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
  it('encabeza con el folio y dice quién la creó', async () => {
    renderDetail()

    expect(await screen.findByRole('heading', { name: '202608130800·D4' })).toBeInTheDocument()
    // El creador viene en la misma respuesta (`createdBy`): ya no es una raya.
    expect(
      screen.getByText(/Villas Coral · Housekeeping · creada por Gerardo Luna/),
    ).toBeInTheDocument()
  })

  it('los totales salen de la entidad, no de contar chips', async () => {
    renderDetail()

    expect(await screen.findByText('6 · 3 ocupados')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('cada posición lleva su cobertura y su urgencia, que no son la misma cosa', async () => {
    renderDetail()

    expect(await screen.findByText('Parcial 1/4')).toBeInTheDocument()
    expect(screen.getByText('Cubierta 2/2')).toBeInTheDocument()

    expect(screen.getByText('< 72 h')).toBeInTheDocument()
    expect(screen.getByText('72 – 120 h')).toBeInTheDocument()
    expect(screen.getAllByText('Tiempo completo').length).toBeGreaterThan(0)
  })

  it('abre con los slots de la primera posición y cambia al elegir otra', async () => {
    const user = userEvent.setup()
    renderDetail()

    expect(await screen.findByText('Slots de la posición 1 · Houseman')).toBeInTheDocument()
    // Ocupado/libre viene del conteo; el nombre de quién ocupa aún no tiene
    // contrato (las asignaciones no exponen la posición del slot).
    expect(screen.getAllByText('occupied')).toHaveLength(1)
    expect(screen.getAllByText('Visible en la Bolsa · Self-Pick')).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: 'Housekeeper' }))

    expect(screen.getByText('Slots de la posición 2 · Housekeeper')).toBeInTheDocument()
    expect(screen.getAllByText('occupied')).toHaveLength(2)
  })

  it('la historia mínima marca dónde nace y cuándo se autorizó', async () => {
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

  it('una requisición sin autorizar solo tiene el asiento del alta', async () => {
    renderDetail('req-0001')

    const history = (await screen.findByText('Historia de estado')).closest('section')
    const entries = within(history as HTMLElement).getAllByRole('listitem')

    expect(entries).toHaveLength(1)
    expect(within(entries[0] as HTMLElement).getByText('Creada')).toBeInTheDocument()
  })
})
