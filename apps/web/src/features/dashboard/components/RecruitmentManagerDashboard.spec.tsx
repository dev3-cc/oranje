import { render, screen, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { RecruitmentManagerDashboard } from './RecruitmentManagerDashboard'

// Registra los datos simulados de colaboradores y requisiciones, como en la app,
// donde el buscador global siempre está montado.
import '@/app/searchApi'
import { store } from '@/app/store'
import type { SessionUser } from '@/shared/types/session.types'

/**
 * El tablero de la Manager de Reclutamiento. En los datos simulados hay dos
 * requisiciones autorizadas sin tomar: Hotel Las Palmas (hace 140 h) y Grand
 * Costa Nube (hace 100 h). Las dos pasan las 24 h, así que las dos son críticas.
 */
const MANAGER = {
  id: 'usr-mgr-reclutamiento',
  name: 'Iván Mora',
  shortName: 'Iván',
  email: 'mgr-reclutamiento@casacurtidor.com',
  roleId: 'ROL-R-03',
  photoUrl: null,
  roleCode: 'ROL-R-03',
  roleTitle: 'Manager de Reclutamiento',
  hotel: null,
  department: null,
} as SessionUser

function renderDashboard(): void {
  const router = createMemoryRouter(
    [{ path: '/dashboard', element: <RecruitmentManagerDashboard session={MANAGER} /> }],
    { initialEntries: ['/dashboard'] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('RecruitmentManagerDashboard', () => {
  it('cuenta como críticas las autorizadas sin tomar hace más de 24 h, la más vieja primero', async () => {
    renderDashboard()

    const lista = (await screen.findByRole('heading', { name: 'Requisiciones críticas' })).closest(
      'section',
    )
    const filas = within(lista as HTMLElement).getAllByRole('link')
    expect(filas).toHaveLength(2)
    expect(filas[0]).toHaveTextContent('Hotel Las Palmas')
    expect(filas[1]).toHaveTextContent('Grand Costa Nube')
  })

  it('enseña la carga del equipo y lleva a Mi Equipo', async () => {
    renderDashboard()

    const equipo = (await screen.findByRole('heading', { name: 'Tu equipo' })).closest('section')
    const scoped = within(equipo as HTMLElement)
    expect(scoped.getByText('Marta Solís')).toBeInTheDocument()
    expect(scoped.getByText('Laura Peña')).toBeInTheDocument()
    expect(scoped.getByRole('link', { name: 'Ver Mi Equipo' })).toHaveAttribute('href', '/my-team')
  })

  it('dice lo que falta construir en vez de inventar números', async () => {
    renderDashboard()

    const pendiente = (
      await screen.findByRole('heading', { name: 'Todavía sin construir' })
    ).closest('section')
    expect(
      within(pendiente as HTMLElement).getByRole('link', { name: 'Incidencias' }),
    ).toHaveAttribute('href', '/incidents')
  })
})
