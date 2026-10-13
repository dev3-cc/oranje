import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConsolidationDetailPage } from './ConsolidationDetailPage'

import { store } from '@/app/store'

/* Los permisos de la sesión cambian por caso: la pantalla decide qué acción
   pintar con `useCan`, así que el mock lee esta variable en cada render. */
const session = vi.hoisted(() => ({ permissions: [] as string[] }))

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
        permissions: session.permissions,
        locale: 'es',
      },
    }),
  }
})

/* Fixtures del mock de settlement: 0001 VALIDATED, 0002 DRAFT, 0003 AUTHORIZED. */
const VALIDATED = '0b1f1c2a-0000-4000-8000-000000000001'
const DRAFT = '0b1f1c2a-0000-4000-8000-000000000002'
const AUTHORIZED = '0b1f1c2a-0000-4000-8000-000000000003'

function renderDetail(id: string): void {
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[`/accounting/consolidations/${id}`]}>
        <Routes>
          <Route
            path="/accounting/consolidations/:consolidationId"
            element={<ConsolidationDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
}

describe('ConsolidationDetailPage', () => {
  beforeEach(() => {
    session.permissions = []
  })

  it('la Contadora revisa un borrador y no ve autorizar ni pagar', async () => {
    session.permissions = ['payroll.read', 'payroll.validate']
    renderDetail(DRAFT)

    expect(await screen.findByRole('button', { name: 'Marcar como revisado' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Autorizar pago' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar pago' })).not.toBeInTheDocument()
  })

  it('el Manager autoriza un revisado y no ve la acción de revisar', async () => {
    session.permissions = ['payroll.read', 'payroll.authorize', 'payroll.mark_paid']
    renderDetail(VALIDATED)

    expect(await screen.findByRole('button', { name: 'Autorizar pago' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marcar como revisado' })).not.toBeInTheDocument()
  })

  it('sin permiso de pago no se dibuja «Registrar pago» en un autorizado', async () => {
    session.permissions = ['payroll.read', 'payroll.validate']
    renderDetail(AUTHORIZED)

    expect(await screen.findByText('Líneas trabajadas')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar pago' })).not.toBeInTheDocument()
  })

  it('el Manager registra el pago de un autorizado y la acción desaparece', async () => {
    const user = userEvent.setup()
    session.permissions = ['payroll.read', 'payroll.mark_paid']
    renderDetail(AUTHORIZED)

    await user.click(await screen.findByRole('button', { name: 'Registrar pago' }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Registrar pago' })).not.toBeInTheDocument(),
    )
  })

  it('muestra las líneas con su hotel y el neto de la deducción', async () => {
    session.permissions = ['payroll.read']
    renderDetail(VALIDATED)

    const lines = await screen.findByRole('table')
    expect(within(lines).getByText('Home2 Suites by Hilton Cartersville')).toBeInTheDocument()
    expect(screen.getByText('$727.00')).toBeInTheDocument()
  })
})
