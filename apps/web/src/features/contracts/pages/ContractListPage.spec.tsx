import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ContractListPage } from './ContractListPage'

import { store } from '@/app/store'

const SLOW = { timeout: 4000 }

function renderList(): void {
  const router = createMemoryRouter([{ path: '/documentos-tc', element: <ContractListPage /> }], {
    initialEntries: ['/documentos-tc'],
  })

  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

/*
 * Toda la suite con tiempo propio: la pantalla monta la lista Y el documento
 * embebido, y en el runner del CI (suite en paralelo) cualquiera de sus casos
 * puede pasarse de los 5 s por defecto. En local pasan siempre.
 */
describe('ContractListPage', { timeout: 20_000 }, () => {
  it('muestra el estado con el valor del enum, sin traducir', async () => {
    renderList()

    expect((await screen.findAllByText('Activo')).length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText('Expirado')).toBeInTheDocument()
    expect(screen.getByText('Borrador')).toBeInTheDocument()
  })

  it('cuenta la vigencia en meses, en días o la da por vencida', async () => {
    renderList()

    expect(await screen.findByText('10 meses restantes')).toBeInTheDocument()
    expect(screen.getByText('3 meses restantes')).toBeInTheDocument()
    expect(screen.getByText('vence en 45 días')).toBeInTheDocument()
    expect(screen.getByText('vencido')).toBeInTheDocument()

    expect(screen.getByText('sin vigencia')).toBeInTheDocument()
    const draft = screen.getByText('CT-2026-0203').closest('button')
    expect(within(draft as HTMLElement).getByText('sin vigencia')).toBeInTheDocument()
  })

  it('elegir un renglón abre su documento a la derecha', async () => {
    const user = userEvent.setup()
    renderList()

    // El primero de la lista se abre solo.
    expect(
      await screen.findByRole('heading', { name: 'Contrato CT-2026-0184' }, SLOW),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /CT-2026-0203/ }))
    expect(
      await screen.findByRole('heading', { name: 'Contrato CT-2026-0203' }, SLOW),
    ).toBeInTheDocument()
  })

  it('«Vencimiento» sí filtra, y el pie cuenta en días con ese mismo plazo', async () => {
    const user = userEvent.setup()
    renderList()

    expect(await screen.findByText('3 meses restantes')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Vencimiento'))
    await user.click(await screen.findByRole('option', { name: 'Vencimiento: en 180 días' }))

    // Fuera el que vence en 310 días, el vencido y el borrador sin vigencia.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /CT-2026-0184/ })).not.toBeInTheDocument()
    }, SLOW)
    expect(screen.queryByText('vencido')).not.toBeInTheDocument()
    expect(screen.queryByText('sin vigencia')).not.toBeInTheDocument()

    // Quedan los dos que vencen dentro del plazo, y a ambos se les cuenta en días.
    expect(screen.getByText('vence en 94 días')).toBeInTheDocument()
    expect(screen.getByText('vence en 45 días')).toBeInTheDocument()
    expect(screen.queryByText('3 meses restantes')).not.toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { pressed: true }).length +
        screen.getAllByRole('button', { pressed: false }).length,
    ).toBe(2)

    // «Quitar filtros» devuelve la lista completa y el umbral por omisión.
    await user.click(screen.getByRole('button', { name: /Quitar filtros/ }))
    expect(await screen.findByRole('button', { name: /CT-2026-0184/ }, SLOW)).toBeInTheDocument()
    expect(screen.getByText('3 meses restantes')).toBeInTheDocument()
  })

  it('el estado sí filtra, y lo hace en el servidor', async () => {
    const user = userEvent.setup()
    renderList()

    await screen.findAllByText('CT-2026-0184')
    await user.click(screen.getByLabelText('Estado'))
    await user.click(await screen.findByRole('option', { name: 'Estado: DRAFT' }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /CT-2026-0184/ })).not.toBeInTheDocument()
    }, SLOW)
    expect(screen.getByRole('button', { name: /CT-2026-0203/ })).toBeInTheDocument()
  })

  it('la búsqueda espera a que dejes de teclear', async () => {
    const user = userEvent.setup()
    renderList()

    await screen.findAllByText('CT-2026-0184')
    await user.type(screen.getByLabelText('Buscar contrato'), 'Mirador')

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /CT-2026-0184/ })).not.toBeInTheDocument()
    }, SLOW)
    expect(screen.getByRole('button', { name: /CT-2026-0098/ })).toBeInTheDocument()
  })
})
