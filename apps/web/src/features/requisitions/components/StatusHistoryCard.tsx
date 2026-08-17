import type { ReactNode } from 'react'

import type { RequisitionStatusEvent } from '../types/requisition.types'

import { SectionCard } from '@/shared/components/SectionCard'
import { SemaforoSoftBadge } from '@/shared/components/SemaforoSoftBadge'
import {
  REQUISITION_STATUS_LABEL,
  REQUISITION_STATUS_TOKEN,
} from '@/shared/constants/requisitionStatus'
import { formatDayMonthTime } from '@/shared/lib/formatters'

/**
 * Historia del semáforo de la requisición, de lo más reciente a lo más antiguo.
 *
 * El subtítulo nombra la propiedad de la tabla a propósito: al ser append-only,
 * esta lista es el árbitro de en qué estado está la requisición y de quién la
 * movió. Nada de lo que aparece aquí se edita ni se borra después.
 */
export function StatusHistoryCard({ history }: { history: RequisitionStatusEvent[] }): ReactNode {
  return (
    <SectionCard title="Historia de estado" subtitle="Append-only: sin updated_at ni deleted_at">
      <ol className="flex flex-col">
        {history.map((event, index) => (
          <li key={event.id} className={index === 0 ? '' : 'mt-5 border-t border-line pt-5'}>
            <div className="flex flex-wrap items-center gap-2">
              {event.fromStatus === null ? (
                <span className="text-sm text-ink-3">nace en</span>
              ) : (
                <>
                  <SemaforoSoftBadge
                    token={REQUISITION_STATUS_TOKEN[event.fromStatus]}
                    label={REQUISITION_STATUS_LABEL[event.fromStatus]}
                  />
                  <span className="text-ink-3" aria-label="cambia a">
                    →
                  </span>
                </>
              )}
              <SemaforoSoftBadge
                token={REQUISITION_STATUS_TOKEN[event.toStatus]}
                label={REQUISITION_STATUS_LABEL[event.toStatus]}
              />
            </div>

            <p className="mt-3 text-base font-semibold text-ink">{event.action}</p>
            <p className="mt-0.5 text-sm text-ink-3">
              {event.byName} · {formatDayMonthTime(event.at)}
            </p>
          </li>
        ))}
      </ol>
    </SectionCard>
  )
}
