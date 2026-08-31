import { statusLight } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { StatusHistoryEntry } from '../types/prospect.types'

import { SectionCard } from '@/shared/components/SectionCard'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDate } from '@/shared/lib/formatters'

/**
 * Historial del semáforo. El punto toma el color del estado de DESTINO, que es
 * el que quedó vigente tras el cambio.
 *
 * El subtítulo nombra la tabla a propósito: cuando alguien discute en qué
 * estado está un prospecto, esta lista es el árbitro.
 */
export function StatusTimeline({ history }: { history: StatusHistoryEntry[] }): ReactNode {
  return (
    <SectionCard
      title="Timeline del semáforo"
      subtitle={
        IS_DEV_UI
          ? 'prospect_state_history — la verdad del semáforo'
          : 'Cada cambio de estado, con quién lo hizo y por qué'
      }
    >
      <ol className="flex flex-col gap-5">
        {history.map((entry) => (
          <li key={entry.id} className="flex gap-3">
            <span
              className="mt-1.5 size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: statusLight[ONBOARDING_STATUS_TOKEN[entry.toStatus]] }}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                {entry.fromStatus ? ONBOARDING_STATUS_LABEL[entry.fromStatus] : '—'} →{' '}
                {ONBOARDING_STATUS_LABEL[entry.toStatus]}
              </p>
              <p className="mt-0.5 text-sm text-ink-3">
                {formatDate(entry.changedAt)} · {entry.byName} · {entry.byRole}
              </p>
              <p className="mt-0.5 text-sm text-ink-2">{entry.note}</p>
            </div>
          </li>
        ))}
      </ol>
    </SectionCard>
  )
}
