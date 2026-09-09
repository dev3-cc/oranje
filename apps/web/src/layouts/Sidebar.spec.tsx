import { SidebarProvider } from '@oranje/ui'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { Sidebar } from './Sidebar'

import { store } from '@/app/store'

/**
 * La sesión mock es un BD (`ROL-V-01`, `sessionApi.ts`): solo ve Dashboard +
 * lo compartido de Ventas — Conversión/Mi Equipo/Reportes son del BDC, y todo
 * lo de Reclutamiento/Hotel/Administrador queda fuera. Antes de que el
 * sidebar mostrara un skeleton mientras la sesión carga, esta lista incluía
 * módulos de OTROS roles por error: la aserción síncrona (sin `await`)
 * alcanzaba a leer el DOM en el instante entre montar y resolver la sesión,
 * cuando el resguardo "sin sesión = ver todo" (línea 87 de `Sidebar.tsx`)
 * pintaba el menú completo — un falso positivo que nunca probó el filtro
 * real. Corregida al mismo tiempo que el skeleton.
 */
const EXPECTED_LINKS: [string, string][] = [
  ['Dashboard', '/dashboard'],
  ['Pipeline', '/pipeline'],
  ['Mi Territorio', '/mi-territorio'],
  ['Propuestas', '/propuestas'],
  ['Documentos T&C', '/documentos-tc'],
  ['Clientes Activos', '/clientes-activos'],
]

/** Módulos de otros roles (Ventas-BDC, Reclutamiento, Hotel, Administrador): el BD de la sesión mock no debe verlos. */
const HIDDEN_LINKS = [
  'Usuarios',
  'Catálogos',
  'Conversión',
  'Mi Equipo',
  'Reportes',
  'Requisiciones',
  'Pool de Colaboradores',
  'Self-Pick',
  'Blacklist',
  'Schedule',
  'Timesheet',
  'Timesheet Global',
  'Mi Personal',
  'Accidentes',
  'Auditorías',
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
  it('los módulos del BD son enlaces navegables, y los de otros roles no aparecen', async () => {
    renderSidebar()

    /* Mientras la sesión resuelve, el sidebar es un skeleton — no la lista completa ni la filtrada. */
    await screen.findByRole('link', { name: 'Dashboard' })
    for (const [label, href] of EXPECTED_LINKS) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href)
    }
    for (const label of HIDDEN_LINKS) {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument()
    }
  })

  it('no pinta contadores mientras no se sepa qué cuentan', async () => {
    renderSidebar()

    const pipeline = await screen.findByRole('link', { name: /Pipeline/ })
    expect(pipeline.textContent).toBe('view_kanbanPipeline')
  })

  it('muestra al usuario de la sesión, sin escribirlo a mano', async () => {
    renderSidebar()

    expect(await screen.findByText('A. Ruiz')).toBeInTheDocument()
    expect(screen.getByText('Business Developer')).toBeInTheDocument()
  })
})
