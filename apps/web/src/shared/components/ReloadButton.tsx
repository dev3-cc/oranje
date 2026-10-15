import { useLingui } from '@lingui/react/macro'
import { MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'

/**
 * Botón de recarga para pantallas con dato que cambia fuera de la app (otro
 * Supervisor marcó un ponche, Contabilidad generó una corrida): sin esto solo
 * se refresca navegando fuera y volviendo (Hugo, 2026-10-14).
 */
export function ReloadButton({
  onReload,
  isReloading,
}: {
  onReload: () => void
  isReloading: boolean
}): ReactNode {
  const { t } = useLingui()
  return (
    <button
      type="button"
      onClick={onReload}
      disabled={isReloading}
      title={t`Traer lo más reciente`}
      aria-label={t`Recargar`}
      className="flex cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
    >
      <MaterialIcon
        name="refresh"
        aria-hidden
        className={isReloading ? 'animate-spin text-base' : 'text-base'}
      />
    </button>
  )
}
