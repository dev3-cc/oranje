import { Trans } from '@lingui/react/macro'
import { MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { ListDetailBreakpoint } from '@/shared/hooks/useListDetail'

const BASE_CLASS =
  '-ml-1.5 flex cursor-pointer items-center gap-1 self-start rounded-md py-1 pr-2 pl-1.5 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink'

/**
 * Solo existe abajo del breakpoint de `useListDetail` (por defecto `lg`): en
 * dos columnas la lista ya está a la vista, no hace falta volver a ella.
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
