import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'

import { useGetMyNotificationsQuery, useGetMyProfileQuery } from '../api/workerApi'

/**
 * El shell del apartado del Colaborador: web responsive que imita la app
 * móvil de la maqueta (columna de 390px, encabezado ORANJE + nombre corto).
 * No lleva el sidebar del staff — el Colaborador no opera ese sistema.
 */
export function MobileShell(): ReactNode {
  const { data: profile } = useGetMyProfileQuery()
  const { data: board } = useGetMyNotificationsQuery()

  /** El contador viene del `meta.unread` del board, no de contar la página. */
  const unread = board?.unread ?? 0
  const shortName = profile
    ? `${profile.fullName.split(/\s+/)[0] ?? ''} ${profile.fullName.split(/\s+/)[1]?.charAt(0) ?? ''}.`
    : ''

  const tabClass = ({ isActive }: { isActive: boolean }): string =>
    cn(
      'flex-1 rounded-full px-3 py-2 text-center text-xs font-semibold transition-colors',
      isActive ? 'bg-o-500 text-ink' : 'text-ink-3 hover:text-ink',
    )

  return (
    <div className="min-h-screen bg-surface-2">
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col bg-surface shadow-lg">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <span className="text-lg font-extrabold tracking-wide text-ink">
            <span className="text-o-500">O</span>RANJE
          </span>
          <span className="flex items-center gap-2 text-sm font-semibold text-ink-2">
            {profile?.photoUrl ? (
              <img src={profile.photoUrl} alt="" className="size-8 rounded-full object-cover" />
            ) : (
              <span
                aria-hidden
                className="flex size-8 items-center justify-center rounded-full bg-o-50 text-xs font-bold text-o-700"
              >
                {profile?.fullName.charAt(0) ?? '·'}
              </span>
            )}
            {shortName}
          </span>
        </header>

        <nav aria-label="Secciones" className="flex gap-1 border-b border-line px-4 py-2.5">
          <NavLink to="/colaborador/alta-2" className={tabClass}>
            Alta · Fase 2
          </NavLink>
          <NavLink to="/colaborador/alta-3" className={tabClass}>
            Fase 3
          </NavLink>
          <NavLink to="/colaborador/avisos" className={tabClass}>
            Avisos{unread > 0 && ` · ${String(unread)}`}
          </NavLink>
        </nav>

        <main className="flex-1 px-5 py-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
