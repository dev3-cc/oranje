import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { PendingApprovalsPage } from './PendingApprovalsPage'

import { store } from '@/app/store'

vi.mock('@/app/sessionApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/sessionApi')>()
  return {
    ...actual,
    useGetSessionQuery: () => ({
      data: {
        id: 'u-test',
        name: 'Prueba',
        shortName: 'Prueba',
        roleId: 'ROL-CO-01',
        photoUrl: null,
        permissions: ['payroll.read'],
        locale: 'es',
      },
    }),
  }
})

function renderPage(): void {
  render(
    <Provider store={store}>
      <MemoryRouter>
        <PendingApprovalsPage />
      </MemoryRouter>
    </Provider>,
  )
}

describe('PendingApprovalsPage', () => {
  it('lista la semana cerrada sin aprobar, con sus días de atraso y su Manager de Área', async () => {
    renderPage()

    // El hotel aparece también en el desglose del KPI: por eso `findAll`.
    expect(
      (await screen.findAllByText('Home2 Suites by Hilton Cartersville')).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText('Mariana Solís').length).toBeGreaterThan(0)
    // El departamento sin Manager de Área lo dice en lugar de dejarlo vacío.
    expect(screen.getAllByText('Sin Manager de Área').length).toBeGreaterThan(0)
  })

  it('muestra el KPI de aprobación oportuna con el porcentaje del periodo', async () => {
    renderPage()

    expect(await screen.findByText('Aprobación oportuna de ponches')).toBeInTheDocument()
    expect(screen.getByText('66.7%')).toBeInTheDocument()
  })
})
