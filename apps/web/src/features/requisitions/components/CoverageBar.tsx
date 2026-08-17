import { statusLight } from '@oranje/ui'
import type { ReactNode } from 'react'

import { describeCoverage } from '../lib/coverage'
import type { RequisitionCoverage } from '../types/requisition.types'

/**
 * Cuántas posiciones están cubiertas, con su barra a escala.
 *
 * La palabra —cubierta, parcial, sin cubrir— va junto a la fracción y no solo
 * en el color de la barra: quien no distinga verde de amarillo tiene que poder
 * leerlo igual.
 */
export function CoverageBar({ coverage }: { coverage: RequisitionCoverage }): ReactNode {
  const { label, token, percent } = describeCoverage(coverage)

  return (
    <div className="min-w-32">
      <p className="text-sm">
        <span className="font-semibold text-ink">
          {coverage.filled}/{coverage.total}
        </span>{' '}
        <span className="text-ink-3">{label}</span>
      </p>

      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3"
        role="img"
        aria-label={`${coverage.filled} de ${coverage.total} posiciones · ${label}`}
      >
        {percent > 0 && (
          <div
            className="h-full rounded-full"
            style={{ width: `${percent.toFixed(1)}%`, backgroundColor: statusLight[token] }}
          />
        )}
      </div>
    </div>
  )
}
