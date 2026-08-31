import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { PoolPage } from './PoolPage'

import { store } from '@/app/store'

const SLOW = { timeout: 4000 }

function renderPool(): void {
  const router = createMemoryRouter([{ path: '/pool-colaboradores', element: <PoolPage /> }], {
    initialEntries: ['/pool-colaboradores'],
  })
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('PoolPage', () => {
  it('el encabezado habla del pool completo, no de la página', async () => {
    renderPool()

    expect(
      await screen.findByText(
        'personal.worker · vw_worker deriva edad y perfil completo · 7 en el pool',
      ),
    ).toBeInTheDocument()
  })

  it('el chip del semáforo enseña el código y lo que significa', async () => {
    renderPool()

    expect((await screen.findAllByText('STRONG_GREEN · Disponible')).length).toBe(2)
    expect(screen.getByText('ORANGE · Fijo')).toBeInTheDocument()
    expect(screen.getByText('WHITE · Pre-asignación')).toBeInTheDocument()
    expect(screen.getByText('BROWN · Asig. temporal')).toBeInTheDocument()
    expect(screen.getByText('GRAY · Accidentado')).toBeInTheDocument()
    expect(screen.getByText('BLACK · Blacklist')).toBeInTheDocument()
  })

  it('perfil e ITIN se leen en palabras', async () => {
    renderPool()

    const row = (await screen.findByText('Pedro Alcántara')).closest('tr')
    const scoped = within(row as HTMLElement)

    expect(scoped.getByText('incompleto')).toBeInTheDocument()
    expect(scoped.getByText('no')).toBeInTheDocument()
    expect(scoped.getByText('31')).toBeInTheDocument()
  })

  it('los filtros van por id de catálogo y filtran en el servidor', async () => {
    const user = userEvent.setup()
    renderPool()

    expect(await screen.findByText('Ana Rivera Gómez')).toBeInTheDocument()
    expect(screen.getByText('Julia Mendoza')).toBeInTheDocument()

    await user.click(await screen.findByLabelText('Posición'))
    await user.click(await screen.findByRole('option', { name: 'Posición: Housekeeper' }))

    await waitFor(() => {
      expect(screen.queryByText('Julia Mendoza')).not.toBeInTheDocument()
    }, SLOW)
    expect(screen.getByText('Ana Rivera Gómez')).toBeInTheDocument()
    expect(screen.getByText('Rogelio Santos')).toBeInTheDocument()
  })

  it('el alta de Fase 1 crea a la persona y nace en Blanco', async () => {
    const user = userEvent.setup()
    renderPool()

    await screen.findByText('Ana Rivera Gómez')
    await user.click(screen.getByRole('button', { name: 'Crear colaborador' }))

    const dialog = await screen.findByRole('dialog')
    const scoped = within(dialog)

    // La intro de 3 diapositivas precede al formulario: se pasa completa.
    await user.click(scoped.getByRole('button', { name: 'Continuar' }))
    await user.click(scoped.getByRole('button', { name: 'Continuar' }))
    await user.click(scoped.getByRole('button', { name: 'Comenzar el alta' }))

    const submit = await scoped.findByRole('button', { name: 'Crear colaborador' })
    expect(submit).toBeDisabled()

    expect(scoped.getByText(/Nace en BLANCO/)).toBeInTheDocument()

    await user.type(scoped.getByPlaceholderText('María Sandoval Ruiz'), 'Braulio Vega')
    await user.type(scoped.getByLabelText('Fecha de nacimiento'), '1994-05-10')
    await user.type(scoped.getByPlaceholderText('404 790 2517'), '404 555 0199')
    await user.type(scoped.getByPlaceholderText(/Peachtree/), '88 Auburn Ave, Atlanta')
    await user.click(await scoped.findByLabelText('Zona'))
    await user.click(await screen.findByRole('option', { name: 'Zona Centro' }))
    expect(submit).toBeEnabled()

    await user.click(submit)

    const row = (await screen.findByText('Braulio Vega', undefined, SLOW)).closest('tr')
    const rowScoped = within(row as HTMLElement)
    expect(rowScoped.getByText('WHITE · Pre-asignación')).toBeInTheDocument()
    expect(rowScoped.getByText('incompleto')).toBeInTheDocument()
  })

  it('posición e inglés llegan como nombre del catálogo, o raya si faltan', async () => {
    renderPool()

    expect((await screen.findAllByText('Conversacional')).length).toBeGreaterThan(0)
    const row = screen.getByText('Pedro Alcántara').closest('tr')
    expect(within(row as HTMLElement).getAllByText('—').length).toBeGreaterThan(1)
  })
  it('la vista de tarjetas agrupa por semáforo y la tarjeta abre la edición', async () => {
    const user = userEvent.setup()
    renderPool()

    await screen.findByText('Ana Rivera Gómez')
    await user.click(screen.getByRole('button', { name: /Tarjetas/ }))

    expect(screen.getByText('Disponible')).toBeInTheDocument()
    expect(screen.getByText('Accidentado')).toBeInTheDocument()
    expect(screen.getAllByText('perfil completo').length).toBeGreaterThan(0)

    const card = screen.getByText('Luis Cabrera').closest('button') as HTMLElement
    await user.click(card)
    expect(await screen.findByText('Editar colaborador')).toBeInTheDocument()
  })
})
