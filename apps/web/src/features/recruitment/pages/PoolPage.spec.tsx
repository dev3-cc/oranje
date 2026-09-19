import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { PoolPage } from './PoolPage'

import { store } from '@/app/store'

const SLOW = { timeout: 4000 }

function renderPool(): void {
  const router = createMemoryRouter([{ path: '/collaborator-pool', element: <PoolPage /> }], {
    initialEntries: ['/collaborator-pool'],
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

    // La intro de 3 diapositivas precede al wizard: se pasa completa.
    await user.click(scoped.getByRole('button', { name: 'Continuar' }))
    await user.click(scoped.getByRole('button', { name: 'Continuar' }))
    await user.click(scoped.getByRole('button', { name: 'Comenzar el alta' }))

    // Paso 1 · Datos personales: «Continuar» hace de submit hasta el paso 3.
    const goNext = await scoped.findByRole('button', { name: 'Continuar' })
    expect(goNext).toBeDisabled()

    expect(scoped.getByText(/personal\.worker/)).toBeInTheDocument()

    await user.type(scoped.getByPlaceholderText('María Sandoval Ruiz'), 'Braulio Vega')

    // Fecha de nacimiento: calendario de shadcn, no el `<input type="date">`
    // nativo (se cierra solo dentro de un Dialog de Radix). Abre ya en el mes
    // límite de los 18 años (`max`, sin `min`): el día 1 siempre cae dentro
    // del rango elegible. El nombre accesible del botón es la fecha completa
    // en palabras («lunes, 1 de …»), así que se ubica por `data-day` —el
    // mismo `toLocaleDateString()` que pinta el botón— en vez de adivinar mes
    // y año a mano, para que la prueba no dependa de qué día es "hoy".
    const day1OfMaxBirthMonth = (() => {
      const date = new Date()
      date.setFullYear(date.getFullYear() - 18)
      date.setDate(1)
      return date.toLocaleDateString()
    })()

    await user.click(scoped.getByLabelText('Fecha de nacimiento'))
    const day1Button = await waitFor(() => {
      const el = document.querySelector(`[data-day="${day1OfMaxBirthMonth}"]`)
      if (!el) throw new Error('el calendario todavía no abre en el día 1')
      return el as HTMLElement
    })
    await user.click(day1Button)

    await user.type(scoped.getByLabelText('Teléfono'), '404 555 0199')
    await user.type(scoped.getByPlaceholderText(/Peachtree/), '88 Auburn Ave, Atlanta')
    await user.click(await scoped.findByLabelText('Zona'))
    await user.click(await screen.findByRole('option', { name: 'Zona Centro' }))
    expect(goNext).toBeEnabled()

    // Paso 2 · Decisiones de Oranje: todo opcional, «Continuar» sigue de largo.
    await user.click(goNext)
    await user.click(scoped.getByRole('button', { name: 'Continuar' }))

    // Paso 3 · Transporte y salud: también opcional; aquí vive el submit real.
    const submit = await scoped.findByRole('button', { name: 'Crear colaborador' })
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
