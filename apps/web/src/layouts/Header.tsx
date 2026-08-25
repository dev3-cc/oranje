import { Input, SidebarTrigger } from '@oranje/ui'
import type { ReactNode } from 'react'

export function Header(): ReactNode {
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
        aria-label="Notificaciones"
        title="Notificaciones"
        className="relative shrink-0 cursor-pointer rounded-md p-2 text-ink-2 transition-colors hover:bg-surface-2"
      >
        <span className="material-icons-outlined text-2xl leading-none" aria-hidden>
          notifications
        </span>
        <span className="absolute top-0.5 right-0.5 flex min-w-4 items-center justify-center rounded-full bg-red px-1 text-[10px] font-semibold text-white">
          3
        </span>
      </button>
    </header>
  )
}
