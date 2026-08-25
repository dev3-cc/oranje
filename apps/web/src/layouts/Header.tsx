import { Input, SidebarTrigger } from '@oranje/ui'
import type { ReactNode } from 'react'

import { useGetSessionQuery } from '@/app/sessionApi'

export function Header(): ReactNode {
  const { data: session } = useGetSessionQuery()

  return (
    <header className="flex h-hd shrink-0 items-center gap-4 border-b border-line bg-surface px-6">
      <SidebarTrigger aria-label="Mostrar u ocultar el menú" className="shrink-0 text-ink-3" />
      <div className="relative min-w-0 flex-1">
        <Input
          type="search"
          aria-label="Buscar hoteles y propuestas"
          placeholder="Buscar hoteles, propuestas..."
          className="h-auto py-2.5 pr-16 pl-4"
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
