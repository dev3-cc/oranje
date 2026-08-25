import { SidebarProvider } from '@oranje/ui'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { Sidebar } from './Sidebar'

import { store } from '@/app/store'

const EXPECTED_LINKS: [string, string][] = [
  ['Dashboard', '/dashboard'],
  ['Pipeline', '/pipeline'],
  ['Mi Territorio', '/mi-territorio'],
  ['Propuestas', '/propuestas'],
  ['Documentos T&C', '/documentos-tc'],
  ['Conversión', '/conversion'],
  ['Clientes Activos', '/clientes-activos'],
  ['Mi Equipo', '/mi-equipo'],
  ['Reportes', '/reportes'],
  ['Requisiciones', '/requisiciones'],
  ['Pool de Colaboradores', '/pool-colaboradores'],
  ['Schedule', '/schedule'],
  ['Timesheet', '/timesheet'],
  ['Timesheet Global', '/timesheet-global'],
  ['Blacklist', '/blacklist'],
  ['Mi Personal', '/mi-personal'],
  ['Accidentes', '/accidentes'],
]

function renderSidebar(): void {
  const router = createMemoryRouter([{ path: '/dashboard', element: <Sidebar /> }], {
    initialEntries: ['/dashboard'],
  })

  render(
    <Provider store={store}>
      <SidebarProvider>
        <RouterProvider router={router} />
      </SidebarProvider>
    </Provider>,
  )
}

describe('Sidebar', () => {
  it('todos los módulos son enlaces navegables', () => {
    renderSidebar()

    for (const [label, href] of EXPECTED_LINKS) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href)
    }
  })

  it('no pinta contadores mientras no se sepa qué cuentan', () => {
    renderSidebar()

    const pipeline = screen.getByRole('link', { name: /Pipeline/ })
    expect(pipeline.textContent).toBe('view_kanbanPipeline')
  })

  it('muestra al usuario de la sesión, sin escribirlo a mano', async () => {
    renderSidebar()

    expect(await screen.findByText('A. Ruiz')).toBeInTheDocument()
    expect(screen.getByText('Business Developer')).toBeInTheDocument()
  })
})
