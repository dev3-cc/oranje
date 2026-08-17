import type { ReactNode } from 'react'

import { describeCoverage } from '../lib/coverage'
import type { RequisitionCoverage } from '../types/requisition.types'

import { SemaforoSoftBadge } from '@/shared/components/SemaforoSoftBadge'

/**
 * La cobertura de una posición como chip: «Parcial 3/4».
 *
 * En el tablero la misma cifra es una barra, porque ahí se comparan filas de un
 * vistazo. Aquí son tres renglones y la fracción exacta importa más que la
 * proporción, así que se escribe.
 */
export function CoverageBadge({ coverage }: { coverage: RequisitionCoverage }): ReactNode {
  const { label, token } = describeCoverage(coverage)
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1)

  return (
    <SemaforoSoftBadge
      token={token}
      label={`${capitalized} ${String(coverage.filled)}/${String(coverage.total)}`}
    />
  )
}
