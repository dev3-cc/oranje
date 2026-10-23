import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import '../api/onboardingApi'

import { ViewProposalDialog } from './ViewProposalDialog'

import { store } from '@/app/store'

/**
 * «Ver propuesta» (Hugo, 2026-10-23): todos los hoteles, y al elegir uno se
 * ve qué tiene y qué se puede hacer — también por qué todavía no se puede.
 */
async function renderDialog(canCreate = true): Promise<void> {
  const router = createMemoryRouter(
    [
      {
        path: '/proposals',
        element: <ViewProposalDialog isOpen canCreate={canCreate} onClose={() => {}} />,
      },
    ],
    { initialEntries: ['/proposals'] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  /* Sin storage en jsdom el intro es fail-open: sale siempre y se salta. */
  await userEvent.click(await screen.findByRole('button', { name: 'Saltar' }))
}

async function elegir(
  user: ReturnType<typeof userEvent.setup>,
  hotel: RegExp,
): Promise<HTMLElement> {
  const lista = await screen.findByRole('list', { name: 'Hoteles' })
  await user.click(within(lista).getByRole('button', { name: hotel }))
  return screen.getByRole('region', { name: 'Propuesta del hotel' })
}

describe('ViewProposalDialog', () => {
  it('lista todos los hoteles, también los que todavía no pueden abrir propuesta', async () => {
    await renderDialog()

    const lista = await screen.findByRole('list', { name: 'Hoteles' })
    expect(within(lista).getByRole('button', { name: /Hotel Riviera Maya/ })).toBeInTheDocument()
    expect(within(lista).getAllByRole('button', { name: /Villas Coral/ }).length).toBeGreaterThan(0)
  })

  it('en un hotel que no está en Verde ni Café dice por qué todavía no se puede', async () => {
    const user = userEvent.setup()
    await renderDialog()

    const panel = await elegir(user, /Hotel Riviera Maya/)
    expect(await within(panel).findByText(/Todavía no se puede crear/)).toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: /Crear propuesta/ })).toBeNull()
  })

  it('con un borrador abierto, lo que se ofrece es seguirlo', async () => {
    const user = userEvent.setup()
    await renderDialog()

    const panel = await elegir(user, /Hotel Mirador.*Verde/)
    expect(
      await within(panel).findByRole('button', { name: /Seguir borrador v3/ }),
    ).toBeInTheDocument()
  })

  it('con la última versión enviada, se abre o se versiona', async () => {
    const user = userEvent.setup()
    await renderDialog()

    const panel = await elegir(user, /Villas Coral.*Cafe/)
    expect(
      await within(panel).findByRole('button', { name: 'Abrir propuesta' }),
    ).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: /Nueva versión \(v2\)/ })).toBeInTheDocument()
  })

  it('sin permiso de crear, se ve la propuesta pero no se versiona', async () => {
    const user = userEvent.setup()
    await renderDialog(false)

    const panel = await elegir(user, /Villas Coral.*Cafe/)
    expect(
      await within(panel).findByRole('button', { name: 'Abrir propuesta' }),
    ).toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: /Nueva versión/ })).toBeNull()
    expect(within(panel).getByText(/es del BD dueño del hotel/)).toBeInTheDocument()
  })
})
