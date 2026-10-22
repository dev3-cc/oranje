import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { MOCK_GENERAL_MANAGER_ID } from '../api/hotelTeamMocks'

import { HotelTeamPage } from './HotelTeamPage'

import { store } from '@/app/store'
import type { SessionUser } from '@/shared/types/session.types'

/**
 * Mi Equipo del Manager General: Alma (Housekeeping) tiene a Saúl e Irene;
 * Bruno (Alimentos y Bebidas) todavía no tiene Supervisores.
 */
const GENERAL: SessionUser = {
  id: MOCK_GENERAL_MANAGER_ID,
  name: 'Gerardo Ruiz',
  shortName: 'Gerardo',
  email: 'mgr-general@casacurtidor.com',
  roleId: 'ROL-H-03',
  photoUrl: null,
  roleCode: 'ROL-H-03',
  roleTitle: 'Manager General',
  hotel: { id: 'htl-1', name: 'Hotel Conversion 4472', timeZone: 'America/Cancun' },
  department: null,
} as SessionUser

function renderTeam(): void {
  const router = createMemoryRouter(
    [{ path: '/my-team', element: <HotelTeamPage session={GENERAL} /> }],
    { initialEntries: ['/my-team'] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('HotelTeamPage', () => {
  it('cada gerente con sus números y, debajo, sus supervisores con los suyos', async () => {
    renderTeam()

    const alma = await screen.findByRole('region', { name: 'Alma Torres' })
    expect(within(alma).getByText('Manager de Área · Housekeeping')).toBeInTheDocument()
    expect(within(alma).getByText('2 supervisores a cargo')).toBeInTheDocument()
    expect(within(alma).getByText('18 colaboradores activos')).toBeInTheDocument()

    const deAlma = within(alma).getByRole('list', { name: 'Supervisores de Alma Torres' })
    expect(within(deAlma).getByText('Saúl Méndez')).toBeInTheDocument()
    expect(within(deAlma).getByText('3 requisiciones este mes')).toBeInTheDocument()
    expect(within(deAlma).getByText('0 requisiciones este mes')).toBeInTheDocument()

    const bruno = screen.getByRole('region', { name: 'Bruno Salas' })
    expect(within(bruno).getByText('Todavía no tiene Supervisores a cargo.')).toBeInTheDocument()
  })

  it('buscar a un supervisor deja a su gerente y solo a esa persona', async () => {
    const user = userEvent.setup()
    renderTeam()

    await screen.findByRole('region', { name: 'Alma Torres' })
    await user.type(screen.getByRole('searchbox', { name: 'Buscar en tu equipo' }), 'Irene')

    const alma = await screen.findByRole('region', { name: 'Alma Torres' })
    expect(within(alma).getByText('Irene Cano')).toBeInTheDocument()
    expect(within(alma).queryByText('Saúl Méndez')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Bruno Salas' })).toBeNull()
  })
})
