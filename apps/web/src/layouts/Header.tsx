import type { ReactNode } from 'react'

import { useGetSessionQuery } from '@/app/sessionApi'

/**
 * Barra superior (`--hd`): buscador global, avisos y perfil.
 *
 * El logo NO va aquí sino en el sidebar: esta barra cubre solo el área de
 * contenido, a la derecha del sidebar. Notificaciones y Perfil sí viven aquí y
 * no en el sidebar (principio 3 de Convenciones de Diseño).
 *
 * ⚠ El buscador todavía no busca: no hay pantalla de resultados ni endpoint de
 * búsqueda. Se deja el campo porque forma parte del shell que se replica.
 */
export function Header(): ReactNode {
  const { data: session } = useGetSessionQuery()

  return (
    <header className="flex h-hd shrink-0 items-center gap-6 border-b border-line bg-surface px-6">
      <div className="relative min-w-0 flex-1">
        <input
          type="search"
          aria-label="Buscar hoteles y propuestas"
          placeholder="Buscar hoteles, propuestas..."
          className="w-full rounded-md border border-line bg-surface py-2.5 pr-16 pl-4 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs text-ink-4">
          Ctrl K
        </kbd>
      </div>

      <button
        type="button"
        className="flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-2 transition-colors hover:bg-surface-2"
      >
        Avisos
        <span className="flex min-w-5 items-center justify-center rounded-full bg-red px-1.5 py-0.5 text-xs font-semibold text-white">
          3
        </span>
      </button>

      <button
        type="button"
        className="flex shrink-0 items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-2"
      >
        <span className="size-8 shrink-0 rounded-full bg-o-50" aria-hidden />
        <span className="text-sm text-ink">
          {session ? `${session.name} · ${session.roleCode}` : '—'}
        </span>
      </button>
    </header>
  )
}
