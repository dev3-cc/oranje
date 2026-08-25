import { SidebarInset, SidebarProvider } from '@oranje/ui'
import type { CSSProperties, ReactNode } from 'react'
import { Outlet } from 'react-router'

import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function AppShell(): ReactNode {
  return (
    <SidebarProvider
      style={{ '--sidebar-width': 'var(--sb)' } as CSSProperties}
      className="h-screen overflow-hidden bg-bg"
    >
      <Sidebar />
      <SidebarInset className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-bg">
        <Header />
        <div className="min-w-0 flex-1 overflow-y-auto p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
