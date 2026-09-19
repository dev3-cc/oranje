import { useLingui } from '@lingui/react/macro'
import { MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { RequisitionStatusEvent } from '../types/requisition.types'

import { SectionCard } from '@/shared/components/SectionCard'
import { formatDayMonthTime } from '@/shared/lib/formatters'

/**
 * Historia del semáforo de la requisición, de lo más reciente a lo más antiguo
 * (solo dev, `IS_DEV_UI` — ver `RequisitionDetailPage`; el rastro real para
 * quien no depura vive en «Ver bitácora»). Compacta a propósito: un ícono por
 * evento en vez de repetir el par de semáforos que ya se ve en el encabezado.
 */
export function StatusHistoryCard({ history }: { history: RequisitionStatusEvent[] }): ReactNode {
  const { t, i18n } = useLingui()

  return (
    <SectionCard title={t`Historia de estado`}>
      <ol className="flex flex-col gap-4">
        {history.map((event) => (
          <li key={event.id} className="flex items-start gap-3">
            <MaterialIcon
              name={event.fromStatus === null ? 'add_circle' : 'check_circle'}
              className="mt-0.5 shrink-0 text-lg text-o-500"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{i18n._(event.action)}</p>
              <p className="text-xs text-ink-3">
                {event.byName} · {formatDayMonthTime(event.at)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </SectionCard>
  )
}
