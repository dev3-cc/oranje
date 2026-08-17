import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { PoolPage } from './PoolPage'

import { store } from '@/app/store'

/** Latencia del mock: el margen por omisión se queda corto al filtrar. */
const SLOW = { timeout: 4000 }

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

    // Se pintan 6 filas y el subtítulo dice 148: la tabla es una página.
    expect(
      await screen.findByText(
        'coverage.vw_pool · vista sobre personal.worker filtrada por estado · 148 en el pool',
      ),
    ).toBeInTheDocument()
  })

  it('el chip del semáforo enseña el código y lo que significa', async () => {
    renderPool()

    expect(await screen.findByText('STRONG_GREEN · Disponible')).toBeInTheDocument()
    expect(screen.getByText('ORANGE · Fijo')).toBeInTheDocument()
    expect(screen.getByText('YELLOW · Disp. voluntario')).toBeInTheDocument()
    expect(screen.getByText('WHITE · Pre-asignación')).toBeInTheDocument()
    expect(screen.getByText('PINK · Stand-by')).toBeInTheDocument()
    expect(screen.getByText('BROWN · Asig. temporal')).toBeInTheDocument()
  })

  it('perfil e ITIN se leen en palabras', async () => {
    renderPool()

    const row = (await screen.findByText('Luis Ferrer')).closest('tr')
    const scoped = within(row as HTMLElement)

    expect(scoped.getByText('incompleto')).toBeInTheDocument()
    expect(scoped.getByText('no')).toBeInTheDocument()
    // La edad llega calculada de la vista, no de una fecha de nacimiento.
    expect(scoped.getByText('25')).toBeInTheDocument()
  })

  it('los filtros arrancan abiertos y filtran en el servidor', async () => {
    const user = userEvent.setup()
    renderPool()

    // Todos a la vista al abrir: la maqueta pone valores de ejemplo en los
    // controles, pero debajo enseña filas que esos valores excluirían.
    expect(await screen.findByText('María Sandoval')).toBeInTheDocument()
    expect(screen.getByText('Luis Ferrer')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Posición'), 'Housekeeper')

    await waitFor(() => {
      expect(screen.queryByText('Luis Ferrer')).not.toBeInTheDocument()
    }, SLOW)
    expect(screen.getByText('María Sandoval')).toBeInTheDocument()
    expect(screen.getByText('Rosa Navarro')).toBeInTheDocument()
  })

  it('el nivel de inglés sale del catálogo compartido', async () => {
    renderPool()

    // «Conversacional» solo existe describiendo a una persona; una requisición
    // pide del mismo catálogo, por eso vive en `shared`.
    expect(await screen.findByText('Conversacional')).toBeInTheDocument()
    expect(screen.getAllByText('Básico')).toHaveLength(3)
  })
})
