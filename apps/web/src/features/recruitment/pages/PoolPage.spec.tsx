import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { PoolPage } from './PoolPage'

import { store } from '@/app/store'

/** Latencia del mock: el margen por omisión se queda corto al filtrar. */
const SLOW = { timeout: 4000 }

/**
 * El Pool va contra `GET /workers` crudo: siete personas de fixture con los
 * catálogos por id (los mismos de Requisiciones) y los estados del seed.
 */
function renderPool(): void {
  render(
    <Provider store={store}>
      <PoolPage />
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
    // Las ramas también existen: el accidentado y el vetado se ven, no se esconden.
    expect(screen.getByText('GRAY · Accidentado')).toBeInTheDocument()
    expect(screen.getByText('BLACK · Blacklist')).toBeInTheDocument()
  })

  it('perfil e ITIN se leen en palabras', async () => {
    renderPool()

    const row = (await screen.findByText('Pedro Alcántara')).closest('tr')
    const scoped = within(row as HTMLElement)

    // Nace en Blanco con el perfil a medias: los datos llegan en tres fases.
    expect(scoped.getByText('incompleto')).toBeInTheDocument()
    // D-27: sin el cifrado conectado, `has_tax_id` es siempre `no`.
    expect(scoped.getByText('no')).toBeInTheDocument()
    expect(scoped.getByText('31')).toBeInTheDocument()
  })

  it('los filtros van por id de catálogo y filtran en el servidor', async () => {
    const user = userEvent.setup()
    renderPool()

    expect(await screen.findByText('Ana Rivera Gómez')).toBeInTheDocument()
    expect(screen.getByText('Julia Mendoza')).toBeInTheDocument()

    // El value del option es el ID (`pos-hk`): así viaja a `GET /workers`.
    await user.selectOptions(await screen.findByLabelText('Posición'), 'pos-hk')

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
    await user.click(screen.getByRole('button', { name: '+ Nuevo colaborador' }))

    const dialog = await screen.findByRole('dialog')
    const scoped = within(dialog)
    const submit = scoped.getByRole('button', { name: 'Crear colaborador' })
    expect(submit).toBeDisabled()

    // La maqueta lo dice: nace en BLANCO y el perfil se completa por la app.
    expect(scoped.getByText(/Nace en BLANCO/)).toBeInTheDocument()

    await user.type(scoped.getByPlaceholderText('María Sandoval Ruiz'), 'Braulio Vega')
    await user.type(scoped.getByLabelText('Fecha de nacimiento'), '1994-05-10')
    await user.type(scoped.getByPlaceholderText('+1 404 790 2517'), '+1 404 555 0199')
    await user.type(scoped.getByPlaceholderText(/Peachtree/), '88 Auburn Ave, Atlanta')
    await user.selectOptions(await scoped.findByLabelText('Zona'), 'centro')
    expect(submit).toBeEnabled()

    await user.click(submit)

    // Aparece en el pool, en Blanco y con el perfil a medias.
    const row = (await screen.findByText('Braulio Vega', undefined, SLOW)).closest('tr')
    const rowScoped = within(row as HTMLElement)
    expect(rowScoped.getByText('WHITE · Pre-asignación')).toBeInTheDocument()
    expect(rowScoped.getByText('incompleto')).toBeInTheDocument()
  })

  it('posición e inglés llegan como nombre del catálogo, o raya si faltan', async () => {
    renderPool()

    expect((await screen.findAllByText('Conversacional')).length).toBeGreaterThan(0)
    // Pedro (Blanco, fase 1) aún no tiene posición ni modalidad: rayas.
    const row = screen.getByText('Pedro Alcántara').closest('tr')
    expect(within(row as HTMLElement).getAllByText('—').length).toBeGreaterThan(1)
  })
})
