import { cn, statusLight } from '@oranje/ui'
import type { ReactNode } from 'react'

import { describeValidity } from '../lib/validity'
import type { ContractRow } from '../types/contract.types'

import { formatDate } from '@/shared/lib/formatters'

/** Sin fecha: guion largo, no hueco. */
const NO_DATE = '—'

/**
 * La vigencia de un contrato: el periodo, cuánto se ha consumido y qué falta.
 *
 * Va con barra y NO con chip a propósito. El chip de esta tabla es el estado, y
 * la vigencia es una magnitud —cuánto se consumió del periodo—, no una etiqueta.
 * Si las dos compitieran en color, el verde significaría «activo» y «recién
 * empezado» en el mismo renglón.
 */
export function ValidityCell({
  row,
  warningDays,
}: {
  row: ContractRow
  warningDays: number
}): ReactNode {
  const { note, isUrgent, token, percent } = describeValidity(row, warningDays)

  return (
    <div className="min-w-56">
      <p className="text-sm text-ink-2">
        {row.validFrom === null ? NO_DATE : formatDate(row.validFrom)} <span aria-hidden>→</span>{' '}
        {/* Indefinido y sin fecha se ven igual aquí; los separa el pie. */}
        {row.validTo === null ? NO_DATE : formatDate(row.validTo)}
      </p>

      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"
        role="img"
        aria-label={`Vigencia: ${note}`}
      >
        {percent > 0 && (
          <div
            className="h-full rounded-full"
            style={{ width: `${percent.toFixed(1)}%`, backgroundColor: statusLight[token] }}
          />
        )}
      </div>

      <p className={cn('mt-2 text-sm', isUrgent ? 'font-semibold text-ink' : 'text-ink-3')}>
        {note}
      </p>
    </div>
  )
}
