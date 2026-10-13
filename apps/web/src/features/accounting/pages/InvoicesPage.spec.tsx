import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InvoicesPage } from './InvoicesPage'

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
        roleId: 'ROL-CO-01',
        photoUrl: null,
        permissions: session.permissions,
        locale: 'es',
      },
    }),
  }
})

function renderInvoices(): void {
  render(
    <Provider store={store}>
      <MemoryRouter>
        <InvoicesPage />
      </MemoryRouter>
    </Provider>,
  )
}

describe('InvoicesPage', () => {
  beforeEach(() => {
    session.permissions = []
  })

  it('la Contadora ve el borrador pendiente de aprobación, sin poder aprobarlo', async () => {
    session.permissions = ['payroll.read']
    renderInvoices()
    /* El intro se ve una vez y tapa el resto de la página mientras está abierto. */
    await userEvent.setup().click(await screen.findByText('Saltar'))

    expect(await screen.findByRole('link', { name: 'FAC-2026-0413' })).toBeInTheDocument()
    expect(screen.getAllByText('Pendiente de aprobación').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'FAC-2026-0412' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'FAC-2026-0405' })).toBeInTheDocument()
  })

  it('el Manager ve el mismo borrador, con la misma lista', async () => {
    session.permissions = ['payroll.read', 'payroll.authorize']
    renderInvoices()
    await userEvent.setup().click(await screen.findByText('Saltar'))

    expect(await screen.findByRole('link', { name: 'FAC-2026-0413' })).toBeInTheDocument()
  })
})
