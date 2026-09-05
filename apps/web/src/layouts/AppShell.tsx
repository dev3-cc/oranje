import { cn, SidebarInset, SidebarProvider, Toaster } from '@oranje/ui'
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, type CSSProperties, type ReactNode } from 'react'
import {
  Navigate,
  NavigationType,
  Outlet,
  useMatches,
  useLocation,
  useNavigate,
  useNavigationType,
} from 'react-router'

import { Header } from './Header'
import { Sidebar } from './Sidebar'

import { useAppSelector } from '@/app/hooks'
import { selectSessionUser } from '@/app/sessionSlice'
import { BackgroundBeams } from '@/shared/components/BackgroundBeams'
import { WORKER_ROLE } from '@/shared/constants/roles'
import { useVersionWatcher } from '@/shared/hooks/useVersionWatcher'
import { saveLastRoute } from '@/shared/lib/lastRoute'
import { MOTION } from '@/shared/lib/motion'

/** Lo que una ruta puede decirle al shell desde `handle` (React Router). */
export type RouteHandle = { fullWidth?: boolean }

export function AppShell(): ReactNode {
  /** Cada navegación se recuerda: si la sesión muere, el login reanuda aquí. */
  const location = useLocation()
  const matches = useMatches()
  const user = useAppSelector(selectSessionUser)
  useEffect(() => {
    if (user) saveLastRoute(user.id, location.pathname)
  }, [user, location.pathname])

  /** El toast de «hay una versión nueva» cuando el hosting cambia de build. */
  useVersionWatcher()

  /**
   * La página entra CON dirección: avanzar desliza desde la derecha y volver
   * (atrás del navegador o la flecha del header) desde la izquierda — el
   * espacio dice hacia dónde te moviste. Sutil (24px) y respetando
   * prefers-reduced-motion; sin animación de salida: la vieja simplemente cede.
   */
  const navigationType = useNavigationType()
  const reduceMotion = useReducedMotion() ?? false
  const navigate = useNavigate()
  /** Profundidad del historial DE ESTA pestaña: 0 = no hay a dónde volver. */
  const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0
  /**
   * La flecha es de SUBVISTAS (decisión de Hugo): las secciones del sidebar
   * no la llevan — volver ahí sería pasear por el historial sin rumbo. En una
   * ruta hija regresa a la vista inmediata anterior; si se llegó por enlace
   * directo (sin historial), sube al padre de la ruta.
   */
  const pathSegments = location.pathname.split('/').filter(Boolean)
  const isSubView = pathSegments.length > 1
  function goBack(): void {
    if (historyIndex > 0) {
      void navigate(-1)
      return
    }
    void navigate(`/${pathSegments.slice(0, -1).join('/')}`)
  }

  /**
   * El Colaborador no opera este shell: sin mapa en el sidebar vería TODO y
   * cada pantalla le daría 403. Su apartado es `/colaborador`, aunque llegue
   * por un enlace o por la ruta reanudada de otra persona.
   */
  if (user?.roleId === WORKER_ROLE) return <Navigate to="/colaborador" replace />

  /**
   * Ancho acotado por defecto (regla de la skill: un solo max-width en toda la
   * app; a 1920 las lista-detalle se desbordaban). Las vistas que trabajan a
   * lo ancho —la cinta del Timesheet, el kanban del Pipeline— lo declaran con
   * `handle: { fullWidth: true }` en su ruta.
   */
  const isFullWidth = matches.some((match) => (match.handle as RouteHandle | undefined)?.fullWidth)

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
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: navigationType === NavigationType.Pop ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reduceMotion ? 0 : MOTION.enter, ease: [...MOTION.easeOut] }}
            className={cn('flex items-start gap-1.5', !isFullWidth && 'mx-auto w-full max-w-7xl')}
          >
            {/* La flecha vive JUNTO al contenido que navega (proximidad, y la
                convención top-left de vuelta) — no suelta en la barra global.
                Alineada con la primera línea de la página. */}
            {isSubView && (
              <button
                type="button"
                aria-label="Volver a la página anterior"
                title="Volver"
                onClick={goBack}
                className="-mt-1 -ml-2 shrink-0 cursor-pointer rounded-md p-1.5 text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <span className="material-icons-outlined text-2xl leading-none" aria-hidden>
                  arrow_back
                </span>
              </button>
            )}
            <div className="min-w-0 flex-1">
              <Outlet />
            </div>
          </motion.div>
        </div>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  )
}
