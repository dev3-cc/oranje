import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InvoiceDetailPage } from './InvoiceDetailPage'

import { store } from '@/app/store'

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
        roleId: 'ROL-CO-02',
        photoUrl: null,
        permissions: session.permissions,
        locale: 'es',
      },
    }),
  }
})

/* Fixtures: inv-0001 SENT, inv-0002 DRAFT, inv-0003 PAID. */
function renderInvoice(id: string): void {
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[`/accounting/invoices/${id}`]}>
        <Routes>
          <Route path="/accounting/invoices/:invoiceId" element={<InvoiceDetailPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
}

describe('InvoiceDetailPage', () => {
  beforeEach(() => {
    session.permissions = []
  })

  it('la Contadora ve el borrador como pendiente de aprobación, sin aprobarlo', async () => {
    session.permissions = ['payroll.read']
    renderInvoice('inv-0002')

    expect(
      await screen.findByText(
        'La aprueba el Manager de Contabilidad, validando bill rate y horas autorizadas.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprobar factura' })).not.toBeInTheDocument()
  })

  it('el Manager aprueba un borrador, pero no ve el cobro', async () => {
    session.permissions = ['payroll.read', 'payroll.authorize']
    renderInvoice('inv-0002')

    expect(await screen.findByRole('button', { name: 'Aprobar factura' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar cobro' })).not.toBeInTheDocument()
  })

  it('registrar el cobro de una emitida exige el permiso de cobro', async () => {
    session.permissions = ['payroll.read', 'payroll.authorize']
    renderInvoice('inv-0001')

    expect(await screen.findByText('Líneas facturadas')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar cobro' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprobar factura' })).not.toBeInTheDocument()
  })

  it('con permiso de cobro, una emitida ofrece registrar el cobro', async () => {
    session.permissions = ['payroll.read', 'payroll.mark_paid']
    renderInvoice('inv-0001')

    expect(await screen.findByRole('button', { name: 'Registrar cobro' })).toBeInTheDocument()
  })

  it('una factura pagada no ofrece ninguna acción', async () => {
    session.permissions = ['payroll.read', 'payroll.authorize', 'payroll.mark_paid']
    renderInvoice('inv-0003')

    expect(await screen.findByText('Líneas facturadas')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /registrar|aprobar/i })).not.toBeInTheDocument()
  })
})
