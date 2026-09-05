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

  it('el chip del semáforo dice el estado en palabras, nunca el color', async () => {
    renderPool()

    expect((await screen.findAllByText(/Disponible/)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Fijo/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Pre-asignación/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Asig. temporal/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Accidentado/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Blacklist/).length).toBeGreaterThan(0)
  })

  it('perfil e ITIN hablan solo como excepción, en el detalle', async () => {
    const user = userEvent.setup()
    renderPool()

    const row = (await screen.findByText('Pedro Alcántara')).closest('li') as HTMLElement
    await user.click(within(row).getByRole('button'))

    const detail = screen.getByRole('article')
    expect(within(detail).getByText(/Perfil incompleto/)).toBeInTheDocument()
    expect(within(detail).getByText(/Sin ITIN/)).toBeInTheDocument()
    expect(within(detail).getByText('31 años')).toBeInTheDocument()
  })

  it('los filtros van por id de catálogo y filtran en el servidor', async () => {
    const user = userEvent.setup()
    renderPool()

    // La primera viene elegida: su nombre vive en la fila Y en el detalle.
    expect((await screen.findAllByText('Ana Rivera Gómez')).length).toBeGreaterThan(0)
    expect(screen.getByText('Julia Mendoza')).toBeInTheDocument()

    await user.click(await screen.findByLabelText('Posición'))
    await user.click(await screen.findByRole('option', { name: 'Posición: Housekeeper' }))

    await waitFor(() => {
      expect(screen.queryByText('Julia Mendoza')).not.toBeInTheDocument()
    }, SLOW)
    expect(screen.getAllByText('Ana Rivera Gómez').length).toBeGreaterThan(0)
    expect(screen.getByText('Rogelio Santos')).toBeInTheDocument()
  })

  it('buscar «Ana» va al servidor y deja solo a Ana, sin distinguir acentos', async () => {
    const user = userEvent.setup()
    renderPool()

    expect((await screen.findAllByText('Ana Rivera Gómez')).length).toBeGreaterThan(0)
    expect(screen.getByText('Julia Mendoza')).toBeInTheDocument()

    const field = screen.getByLabelText('Buscar colaborador')
    await user.type(field, 'Ana')

    // La búsqueda espera a que se deje de teclear y viaja como `?search=`.
    await waitFor(() => {
      expect(screen.queryByText('Julia Mendoza')).not.toBeInTheDocument()
    }, SLOW)
    expect(screen.queryByText('Luis Cabrera')).not.toBeInTheDocument()
    expect(screen.queryByText('Pedro Alcántara')).not.toBeInTheDocument()
    expect(screen.getAllByText('Ana Rivera Gómez').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Quitar filtros/ })).toBeInTheDocument()

    // «gomez» encuentra «Gómez»: el acento no separa.
    await user.clear(field)
    await user.type(field, 'gomez')
    await waitFor(() => {
      expect(screen.getAllByText('Ana Rivera Gómez').length).toBeGreaterThan(0)
    }, SLOW)
    expect(screen.queryByText('Julia Mendoza')).not.toBeInTheDocument()

    // Quitar filtros devuelve el pool completo.
    await user.click(screen.getByRole('button', { name: /Quitar filtros/ }))
    expect(await screen.findByText('Julia Mendoza', undefined, SLOW)).toBeInTheDocument()
  })

  it('el alta de Fase 1 crea a la persona y nace en Blanco', async () => {
    const user = userEvent.setup()
    renderPool()

    await screen.findAllByText('Ana Rivera Gómez')
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

    // Recién creado puede quedar elegido (fila + detalle): se toma la fila.
    const row = (await screen.findAllByText('Braulio Vega', undefined, SLOW))
      .map((node) => node.closest('li'))
      .find(Boolean)
    // La fila dice su estado en palabras: recién nacido = Pre-asignación.
    expect(within(row as HTMLElement).getByText(/Pre-asignación/)).toBeInTheDocument()
    // El recorrido entero (intro + formulario + refetch) no cabe en 5 s.
  }, 15000)

  it('el detalle dice los catálogos por nombre, o raya si faltan', async () => {
    const user = userEvent.setup()
    renderPool()

    const row = (await screen.findByText('Pedro Alcántara')).closest('li') as HTMLElement
    await user.click(within(row).getByRole('button'))
    const detail = screen.getByRole('article')
    expect(within(detail).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('la fila abre el detalle y desde ahí se edita', async () => {
    const user = userEvent.setup()
    renderPool()

    const row = (await screen.findByText('Luis Cabrera')).closest('li') as HTMLElement
    await user.click(within(row).getByRole('button'))
    await user.click(within(screen.getByRole('article')).getByRole('button', { name: 'Editar' }))
    expect(await screen.findByText('Editar colaborador')).toBeInTheDocument()
  })
})
