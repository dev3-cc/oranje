import { Trans } from '@lingui/react/macro'
import { MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { ListDetailBreakpoint } from '@/shared/hooks/useListDetail'

/**
 * «Ver →» al final de una fila de lista-detalle, SOLO abajo del breakpoint
 * donde lista y detalle se apilan (Hugo, 2026-10-12, con captura): en ese
 * ancho una tarjeta sin flecha no avisa que es tocable — pasa por texto, no
 * por botón. Desde el breakpoint las dos columnas conviven lado a lado y la
 * flecha sobra, así que se esconde (mismo criterio de `rosterListClass`: las
 * clases van completas, nunca armadas con `${breakpoint}` — Tailwind no ve
 * una clase interpolada).
 */
export function ListItemViewHint({
  breakpoint = 'lg',
}: {
  breakpoint?: ListDetailBreakpoint
}): ReactNode {
  return (
    <span
      className={
        breakpoint === 'xl'
          ? 'flex shrink-0 items-center gap-0.5 text-xs font-semibold text-o-700 xl:hidden'
          : 'flex shrink-0 items-center gap-0.5 text-xs font-semibold text-o-700 lg:hidden'
      }
    >
      <Trans>Ver</Trans>
      <MaterialIcon name="chevron_right" className="text-base" aria-hidden />
    </span>
  )
}
