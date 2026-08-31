import { SidebarInset, SidebarProvider, Toaster } from '@oranje/ui'
import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'

import { Header } from './Header'
import { Sidebar } from './Sidebar'

import { useAppSelector } from '@/app/hooks'
import { selectSessionUser } from '@/app/sessionSlice'
import { BackgroundBeams } from '@/shared/components/BackgroundBeams'
import { WORKER_ROLE } from '@/shared/constants/roles'
import { useVersionWatcher } from '@/shared/hooks/useVersionWatcher'
import { saveLastRoute } from '@/shared/lib/lastRoute'

export function AppShell(): ReactNode {
  /** Cada navegación se recuerda: si la sesión muere, el login reanuda aquí. */
  const location = useLocation()
  const user = useAppSelector(selectSessionUser)
  useEffect(() => {
    if (user) saveLastRoute(user.id, location.pathname)
  }, [user, location.pathname])

  /** El toast de «hay una versión nueva» cuando el hosting cambia de build. */
  useVersionWatcher()

  /**
   * El Colaborador no opera este shell: sin mapa en el sidebar vería TODO y
   * cada pantalla le daría 403. Su apartado es `/colaborador`, aunque llegue
   * por un enlace o por la ruta reanudada de otra persona.
   */
  if (user?.roleId === WORKER_ROLE) return <Navigate to="/colaborador" replace />

  return (
    <SidebarProvider
      style={{ '--sidebar-width': 'var(--sb)' } as CSSProperties}
      className="h-screen overflow-hidden bg-bg"
    >
      <Sidebar />
      <SidebarInset className="relative flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-bg">
        <BackgroundBeams />
        <Header />
        <div className="relative min-w-0 flex-1 overflow-x-clip overflow-y-auto p-6">
          <Outlet />
        </div>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  )
}
