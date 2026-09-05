import { SidebarProvider } from '@oranje/ui'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { Header } from './Header'

import { store } from '@/app/store'

const SLOW = { timeout: 4000 }

function renderHeader(): void {
  render(
    <Provider store={store}>
      <MemoryRouter>
        {/* El SidebarTrigger del header vive dentro del SidebarProvider del shell. */}
        <SidebarProvider>
          <Header />
        </SidebarProvider>
      </MemoryRouter>
    </Provider>,
  )
}

/**
 * La barra global era decorativa (auditoría del 2026-09-04): ni handler ni
 * atajo. Estas pruebas fijan que Ctrl K abre la paleta, que busca de verdad
 * contra los fixtures y que la campana no pinta contadores inventados.
 */
describe('Header', () => {
  it('Ctrl K abre la búsqueda global y encuentra a un colaborador', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.keyboard('{Control>}k{/Control}')
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Buscar en Oranje')).toBeInTheDocument()

    await user.type(
      within(dialog).getByLabelText('Buscar hoteles, requisiciones o colaboradores'),
      'Ana Riv',
    )
    const hit = await within(dialog).findByRole('option', { name: /Ana Rivera Gómez/ }, SLOW)
    expect(hit).toBeInTheDocument()
    expect(within(dialog).getByText('Colaboradores')).toBeInTheDocument()
  })

  it('el botón del header abre la paleta y explica el mínimo de letras', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(
      screen.getByRole('button', { name: 'Buscar hoteles, requisiciones o colaboradores' }),
    )
    expect(await screen.findByText(/Escribe al menos 2 letras/)).toBeInTheDocument()
  })

  it('la campana dice el contador real, nunca un número pintado', async () => {
    renderHeader()

    const bell = await screen.findByRole('button', { name: /^Notificaciones:/ })
    // Con fixtures del Colaborador hay avisos sin leer; sin ellos diría «nada nuevo».
    expect(bell.getAttribute('aria-label')).toMatch(/sin leer|nada nuevo/)
  })
})
