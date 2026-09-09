import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

/** Piezas que comparten las dos listas de Usuarios (personal Oranje y cuentas del hotel). */

export const DATE_FORMAT = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
}

export function CellStat({
  value,
  label,
  tone,
}: {
  value: ReactNode
  label: string
  tone?: 'muted'
}): ReactNode {
  return (
    <div className="hidden w-36 shrink-0 flex-col gap-0.5 md:flex">
      <span className={cn('truncate text-sm', tone === 'muted' ? 'text-ink-3' : 'text-ink')}>
        {value}
      </span>
      <span className="text-xs text-ink-4">{label}</span>
    </div>
  )
}

/** Inactivo / Ya entró / Invitación enviada: el estado de la cuenta, con texto (color nunca solo). */
export function AccountStatusChip({
  isActive,
  hasAccount,
}: {
  isActive: boolean
  hasAccount: boolean
}): ReactNode {
  if (!isActive) {
    return (
      <span className="rounded-full bg-surface-3/70 px-2.5 py-1 text-xs font-semibold text-ink-3">
        Inactivo
      </span>
    )
  }
  if (hasAccount) {
    return (
      <span className="rounded-full bg-green/10 px-2.5 py-1 text-xs font-semibold text-green">
        Ya entró
      </span>
    )
  }
  return (
    <span className="rounded-full bg-yellow/15 px-2.5 py-1 text-xs font-semibold text-o-700">
      Invitación enviada
    </span>
  )
}

/** Las píldoras Activos / Inactivos con su conteo. */
export function StatusTabs({
  tab,
  onChange,
  activeTotal,
  inactiveTotal,
}: {
  tab: 'active' | 'inactive'
  onChange: (tab: 'active' | 'inactive') => void
  activeTotal: number
  inactiveTotal: number
}): ReactNode {
  return (
    <>
      {(
        [
          ['active', 'Activos', activeTotal],
          ['inactive', 'Inactivos', inactiveTotal],
        ] as Array<['active' | 'inactive', string, number]>
      ).map(([key, label, count]) => (
        <button
          key={key}
          type="button"
          onClick={() => {
            onChange(key)
          }}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors',
            tab === key
              ? 'bg-o-50 font-semibold text-o-700'
              : 'text-ink-3 hover:bg-surface-2 hover:text-ink',
          )}
        >
          <span
            className={cn(
              'flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-bold',
              tab === key ? 'bg-o-500 text-ink' : 'bg-surface-3 text-ink-2',
            )}
          >
            {count}
          </span>
          {label}
        </button>
      ))}
    </>
  )
}
