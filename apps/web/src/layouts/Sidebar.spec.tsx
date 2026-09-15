import { I18nProvider } from '@lingui/react'
import { SidebarProvider } from '@oranje/ui'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { Sidebar } from './Sidebar'

import { i18n } from '@/app/i18n'
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
  ['Contratos', '/contratos'],
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
    <I18nProvider i18n={i18n}>
      <Provider store={store}>
        <SidebarProvider>
          <RouterProvider router={router} />
        </SidebarProvider>
      </Provider>
    </I18nProvider>,
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

  /**
   * El `NavLink` recibía un `className` de función (su propio `isActive`),
   * pero `asChild` de `SidebarMenuButton` lo fusiona vía Slot, que solo sabe
   * unir strings — aplastaba la función a su código fuente y el fondo activo
   * nunca se pintaba, en NINGÚN módulo, sin que ningún test lo notara.
   */
  it('resalta el módulo de la ruta activa, y solo ese', async () => {
    renderSidebar()

    const dashboardButton = (await screen.findByRole('link', { name: 'Dashboard' })).closest(
      '[data-sidebar="menu-button"]',
    )
    const pipelineButton = screen
      .getByRole('link', { name: 'Pipeline' })
      .closest('[data-sidebar="menu-button"]')

    expect(dashboardButton).toHaveAttribute('data-active', 'true')
    expect(pipelineButton).toHaveAttribute('data-active', 'false')
  })

  /**
   * Antes, `logout()` esperaba a que la mutación resolviera para limpiar la
   * sesión — mientras tanto `RequireSession` seguía viendo `status:
   * 'authenticated'` en `/usuarios` y no navegaba a ningún lado; al
   * resolver, redirigía con `state.from = '/usuarios'`, y quien entraba
   * DESPUÉS con otro rol aterrizaba en una pantalla que no era la suya (el
   * reporte de Hugo: "se queda pegado en pantallas del rol anterior").
   */
  it('el logout navega a /login de inmediato, sin esperar a que la sesión se limpie', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter(
      [
        { path: '/usuarios', element: <Sidebar /> },
        { path: '/login', element: <p>Pantalla de login</p> },
      ],
      { initialEntries: ['/usuarios'] },
    )

    render(
      <I18nProvider i18n={i18n}>
        <Provider store={store}>
          <SidebarProvider>
            <RouterProvider router={router} />
          </SidebarProvider>
        </Provider>
      </I18nProvider>,
    )

    const logoutButton = await screen.findByRole('button', { name: 'Cerrar sesión' })
    await user.click(logoutButton)

    expect(await screen.findByText('Pantalla de login')).toBeInTheDocument()
  })
})
