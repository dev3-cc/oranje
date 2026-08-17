import { render, screen, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ContractDetailPage } from './ContractDetailPage'

import { store } from '@/app/store'

function renderDetail(contractId = 'ct-0184'): void {
  const router = createMemoryRouter(
    [{ path: '/documentos-tc/:contractId', element: <ContractDetailPage /> }],
    { initialEntries: [`/documentos-tc/${contractId}`] },
  )

  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('ContractDetailPage', () => {
  it('encabeza con el contrato, su estado y quién lo firmó', async () => {
    renderDetail()

    expect(
      await screen.findByRole('heading', { name: 'Contrato CT-2026-0184' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'commercial.contract · Hotel Puerto Real · firmado por Lucía Márquez el 20 jun 2026',
      ),
    ).toBeInTheDocument()
  })

  it('traduce la semana de nómina y enseña los números que la guardan', async () => {
    renderDetail()

    // Domingo es 0, así que la semana termina en un número menor que el que la
    // empieza: por eso se muestran también los crudos.
    expect(await screen.findByText('Lunes → Domingo')).toBeInTheDocument()
    expect(screen.getByText('week_start_day 1 · week_end_day 0')).toBeInTheDocument()
  })

  it('el margen se calcula: es una resta dentro de la misma respuesta', async () => {
    renderDetail()

    // 2.00 − 1.50 y 2.50 − 2.00, ambos +0.50.
    expect(await screen.findAllByText('+0.50')).toHaveLength(2)

    // 250 − 170 = 80, y así con las cuatro posiciones.
    const housekeeper = screen.getByText('Housekeeper').closest('tr')
    expect(within(housekeeper as HTMLElement).getByText('$80.00')).toBeInTheDocument()
    expect(screen.getByText('$120.00')).toBeInTheDocument()
  })

  it('nombra las restricciones de la base con su nombre real', async () => {
    renderDetail()

    expect(await screen.findByText('ux_contract_active')).toBeInTheDocument()
    expect(screen.getByText('ck_contract_multiplier_margin')).toBeInTheDocument()
    expect(screen.getByText('ck_contract_validity')).toBeInTheDocument()
  })

  it('un contrato sin fin dice indefinido, no una fecha vacía', async () => {
    renderDetail('ct-0203')

    expect(await screen.findByText('Indefinido')).toBeInTheDocument()
    expect(screen.getByText('Todavía no se cotiza ninguna posición.')).toBeInTheDocument()
  })
})
