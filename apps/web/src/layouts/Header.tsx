import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  MaterialIcon,
  SidebarTrigger,
} from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import { GlobalSearch } from './GlobalSearch'

import {
  useGetHeaderNotificationsQuery,
  useMarkHeaderNotificationReadMutation,
} from '@/app/notificationsApi'
import { formatDayMonthTime } from '@/shared/lib/formatters'

/** `⌘K` en Mac, `Ctrl K` en el resto: el atajo se anuncia como se pulsa. */
const SHORTCUT_LABEL =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K'

export function Header(): ReactNode {
  const [isSearchOpen, setSearchOpen] = useState(false)

  /* El atajo que el header promete de verdad existe: Ctrl/⌘ + K abre la
     búsqueda desde cualquier pantalla (auditoría: antes era solo texto). */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const { data: notifications } = useGetHeaderNotificationsQuery()
  const [markRead] = useMarkHeaderNotificationReadMutation()
  const unread = notifications?.unread ?? 0

  return (
    <header className="relative flex h-hd shrink-0 items-center gap-4 border-b border-line bg-surface px-6">
      <SidebarTrigger aria-label="Mostrar u ocultar el menú" className="shrink-0 text-ink-3" />

      {/* Un BOTÓN que parece campo: abre la paleta. No es un input a medias
          — la búsqueda real vive en el diálogo, con teclado completo. */}
      <button
        type="button"
        onClick={() => {
          setSearchOpen(true)
        }}
        aria-label="Buscar hoteles, requisiciones o colaboradores"
        className="relative flex min-w-0 max-w-md flex-1 cursor-text items-center gap-2 rounded-md border border-line bg-surface py-2.5 pr-16 pl-3 text-left text-sm text-ink-4 transition-colors hover:border-ink-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
      >
        <MaterialIcon name="search" className="text-lg text-ink-4" aria-hidden />
        <span className="truncate">Buscar hoteles, requisiciones, colaboradores…</span>
        <kbd className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs text-ink-4">
          {SHORTCUT_LABEL}
        </kbd>
      </button>

      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => {
          setSearchOpen(false)
        }}
      />

      {/* La campana con su contador REAL; sin avisos nuevos, sin globo. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={
              unread > 0
                ? `Notificaciones: ${String(unread)} sin leer`
                : 'Notificaciones: nada nuevo'
            }
            title="Notificaciones"
            className="relative shrink-0 cursor-pointer rounded-md p-2 text-ink-2 transition-colors hover:bg-surface-2"
          >
            <MaterialIcon name="notifications" className="text-2xl" aria-hidden />
            {unread > 0 && (
              <span className="absolute top-0.5 right-0.5 flex min-w-4 items-center justify-center rounded-full bg-red px-1 text-[10px] font-semibold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>
            Avisos{unread > 0 && ` · ${String(unread)} sin leer`}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {notifications === undefined || notifications.items.length === 0 ? (
            <p className="px-2 py-3 text-sm text-ink-3">Sin avisos por ahora.</p>
          ) : (
            notifications.items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onSelect={() => {
                  if (!item.isRead) void markRead(item.id)
                }}
                className={cn('flex flex-col items-start gap-0.5', !item.isRead && 'bg-o-50/60')}
              >
                <span className="flex w-full items-center gap-2">
                  {!item.isRead && (
                    <span aria-hidden className="size-2 shrink-0 rounded-full bg-o-500" />
                  )}
                  <span className="truncate text-sm font-semibold text-ink">{item.title}</span>
                </span>
                <span className="line-clamp-2 text-xs text-ink-2">{item.body}</span>
                <span className="text-[11px] text-ink-4">{formatDayMonthTime(item.createdAt)}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
