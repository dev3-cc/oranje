import type { ReactNode } from 'react'
import { Outlet } from 'react-router'

import { Header } from './Header'
import { Sidebar } from './Sidebar'

/**
 * Shell base: el sidebar ocupa toda la altura y la barra superior cubre solo el
 * área de contenido, a su derecha.
 *
 * Así lo fija la maqueta del dashboard, y es lo que deja el logo y la tarjeta de
 * usuario dentro del sidebar, alineados con el módulo al que pertenecen.
 */
export function AppShell(): ReactNode {
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="min-w-0 flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
