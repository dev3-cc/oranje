import { Trans } from '@lingui/react/macro'
import { MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { ListDetailBreakpoint } from '@/shared/hooks/useListDetail'

const BASE_CLASS =
  'flex cursor-pointer items-center gap-1.5 self-start rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-2 shadow-xs transition-colors hover:border-o-500/40 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500'

/**
 * Solo existe abajo del breakpoint de `useListDetail` (por defecto `lg`): en
 * dos columnas la lista ya está a la vista, no hace falta volver a ella.
 *
 * Con borde + fondo, no solo texto: sin ellos se perdía en pantallas con
 * mucho aire alrededor —el detalle del Timesheet, por ejemplo— y leía como
 * texto suelto, no como un control (Hugo, 2026-10-12; misma regla que un
 * input sin borde no parece escribible).
 */
export function BackToListButton({
  onClick,
  breakpoint = 'lg',
}: {
  onClick: () => void
  breakpoint?: ListDetailBreakpoint
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      className={breakpoint === 'xl' ? `${BASE_CLASS} xl:hidden` : `${BASE_CLASS} lg:hidden`}
    >
      <MaterialIcon name="arrow_back" className="text-lg" aria-hidden />
      <Trans>Volver a la lista</Trans>
    </button>
  )
}
