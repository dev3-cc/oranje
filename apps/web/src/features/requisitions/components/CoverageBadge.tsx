import { useLingui } from '@lingui/react'
import type { ReactNode } from 'react'

import type { RequisitionCoverage } from '../types/requisition.types'
import { describeCoverage } from '../utils/coverage'

import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'

/**
 * La cobertura de una posición como chip: «Parcial 3/4».
 *
 * En el tablero la misma cifra es una barra, porque ahí se comparan filas de un
 * vistazo. Aquí son tres renglones y la fracción exacta importa más que la
 * proporción, así que se escribe.
 */
export function CoverageBadge({ coverage }: { coverage: RequisitionCoverage }): ReactNode {
  const { i18n } = useLingui()
  const { label: labelDescriptor, token } = describeCoverage(coverage)
  const label = i18n._(labelDescriptor)
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1)

  return (
    <StatusLightSoftBadge
      token={token}
      label={`${capitalized} ${String(coverage.filled)}/${String(coverage.total)}`}
    />
  )
}
