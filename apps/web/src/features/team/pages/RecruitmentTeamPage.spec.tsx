import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { MOCK_MANAGER_ID } from '../api/recruitmentTeamMocks'

import { RecruitmentTeamPage } from './RecruitmentTeamPage'

import { store } from '@/app/store'
import type { SessionUser } from '@/shared/types/session.types'

/**
 * Mi Equipo de la Manager de Reclutamiento: Laura Peña es Líder y tiene a
 * Marta en su grupo; Víanney le reporta directo a la Manager y todavía no ha
 * hecho nada, que es como se ve alguien recién dado de alta.
 */
const MANAGER: SessionUser = {
  id: MOCK_MANAGER_ID,
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

function renderTeam(entry = '/my-team'): void {
  const router = createMemoryRouter(
    [{ path: '/my-team', element: <RecruitmentTeamPage session={MANAGER} /> }],
    { initialEntries: [entry] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('RecruitmentTeamPage', () => {
  it('agrupa por Líder y deja aparte a quien le reporta directo', async () => {
    renderTeam()

    const grupoLaura = await screen.findByRole('region', { name: 'Grupo de Laura Peña' })
    expect(within(grupoLaura).getByRole('button', { name: /Laura Peña/ })).toBeInTheDocument()
    expect(within(grupoLaura).getByRole('button', { name: /Marta Solís/ })).toBeInTheDocument()

    const directo = screen.getByRole('region', { name: 'Te reportan directo' })
    expect(within(directo).getByRole('button', { name: /Víanney Hernández/ })).toBeInTheDocument()
  })

  it('los totales suman lo de todo el equipo', async () => {
    renderTeam()

    const personas = (await screen.findByText('Personas en tu equipo')).closest('[data-slot=card]')
    expect(within(personas as HTMLElement).getByText('3')).toBeInTheDocument()
    const abiertas = screen
      .getByText('Requisiciones que están llenando', {
        selector: '[data-slot=card] *',
      })
      .closest('[data-slot=card]')
    expect(within(abiertas as HTMLElement).getByText('5')).toBeInTheDocument()
  })

  it('a una Líder no se le ofrece moverla; a alguien sin actividad no se le inventan números', async () => {
    const user = userEvent.setup()
    renderTeam()

    const laura = (await screen.findByRole('heading', { name: 'Laura Peña' })).closest('article')
    expect(
      within(laura as HTMLElement).queryByRole('button', { name: 'Cambiar de Líder' }),
    ).toBeNull()

    await user.click(screen.getByRole('button', { name: /Víanney Hernández/ }))
    const vianney = (await screen.findByRole('heading', { name: 'Víanney Hernández' })).closest(
      'article',
    )
    expect(
      within(vianney as HTMLElement).getAllByText('Sin altas ni asignaciones todavía').length,
    ).toBeGreaterThan(0)
    expect(
      within(vianney as HTMLElement).getByRole('button', { name: 'Cambiar de Líder' }),
    ).toBeInTheDocument()
  })

  it('desde la persona se abre cada requisición abierta y cada alta suya', async () => {
    const user = userEvent.setup()
    renderTeam()

    const laura = (await screen.findByRole('heading', { name: 'Laura Peña' })).closest('article')
    const requisiciones = within(laura as HTMLElement).getByRole('region', {
      name: 'Requisiciones que está llenando',
    })
    expect(within(requisiciones).getByRole('link', { name: /Hotel Mirador/ })).toHaveAttribute(
      'href',
      '/requisitions/req-0008',
    )
    // Quiénes dio de alta en 30 días, con su estado de hoy; aparte, las que siguen en Blanco.
    const altas = within(laura as HTMLElement).getByRole('region', { name: 'Sus altas' })
    expect(within(altas).getByRole('link', { name: /Luis Cabrera/ })).toHaveAttribute(
      'href',
      '/collaborator-pool/wrk-0002',
    )
    expect(within(altas).getAllByRole('link')).toHaveLength(4)
    await user.click(within(altas).getByRole('tab', { name: 'Por validar · 1' }))
    expect(await within(altas).findByRole('link', { name: /Pedro Alcántara/ })).toHaveAttribute(
      'href',
      '/collaborator-pool/wrk-0004',
    )
    expect(within(altas).queryByRole('link', { name: /Luis Cabrera/ })).toBeNull()
    expect(
      within(laura as HTMLElement).getByRole('link', {
        name: 'lider-reclutadoras@casacurtidor.com',
      }),
    ).toHaveAttribute('href', 'mailto:lider-reclutadoras@casacurtidor.com')
  })

  it('con ?persona= abre directo a esa persona', async () => {
    renderTeam('/my-team?persona=usr-recl-marta')

    expect(await screen.findByRole('heading', { name: 'Marta Solís' })).toBeInTheDocument()
  })

  it('mover a una Reclutadora con una Líder la pasa al grupo de esa Líder', async () => {
    const user = userEvent.setup()
    renderTeam()

    await user.click(await screen.findByRole('button', { name: /Víanney Hernández/ }))
    await user.click(await screen.findByRole('button', { name: 'Cambiar de Líder' }))
    await user.click(await screen.findByRole('combobox', { name: 'Pasa a reportar a' }))
    await user.click(await screen.findByRole('option', { name: 'Laura Peña' }))
    await user.click(screen.getByRole('button', { name: 'Mover con Laura Peña' }))

    const grupoLaura = await screen.findByRole('region', { name: 'Grupo de Laura Peña' })
    expect(
      await within(grupoLaura).findByRole('button', { name: /Víanney Hernández/ }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Te reportan directo' })).toBeNull()
  })
})
