import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AccountingTimesheetPage } from './AccountingTimesheetPage'

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

function renderTimesheet(): void {
  render(
    <Provider store={store}>
      <MemoryRouter>
        <AccountingTimesheetPage />
      </MemoryRouter>
    </Provider>,
  )
}

describe('AccountingTimesheetPage', () => {
  beforeEach(() => {
    session.permissions = []
  })

  it('sin el permiso de todos los hoteles no consulta nada y lo dice', () => {
    /* Una lista vacía es el resguardo «todo visible»: hace falta otro permiso para negarlo. */
    session.permissions = ['payroll.read']
    renderTimesheet()

    expect(
      screen.getByText('Tu rol todavía no tiene acceso a las horas de todos los hoteles.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('con el permiso lista las horas de todos los hoteles, solo lectura', async () => {
    session.permissions = ['timesheet.read_all_hotels']
    renderTimesheet()

    expect((await screen.findAllByText('Ana Rivera Gómez')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /aprobar|enviar|marca/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Corregir')).not.toBeInTheDocument()
  })

  it('con payroll.generate, además, puede abrir la corrección de una hoja', async () => {
    session.permissions = ['timesheet.read_all_hotels', 'payroll.generate']
    renderTimesheet()
    const user = userEvent.setup()

    /* El intro se ve una vez y tapa el resto de la página mientras está
       abierto (mismo patrón que el resto de los onboardings). */
    await user.click(await screen.findByText('Saltar'))

    const buttons = await screen.findAllByText('Corregir')
    expect(buttons.length).toBeGreaterThan(0)
    await user.click(buttons[0] as HTMLElement)

    expect(await screen.findByText(/^Corregir pago de/)).toBeInTheDocument()
    expect(screen.getByText('Guardar corrección')).toBeInTheDocument()
  })
})
