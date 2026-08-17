import type { ReactNode } from 'react'

import type { ContactAttempt } from '../types/prospect.types'

import { SectionCard } from '@/shared/components/SectionCard'
import { formatDayMonth } from '@/shared/lib/formatters'

export function ContactAttemptLog({ attempts }: { attempts: ContactAttempt[] }): ReactNode {
  return (
    <SectionCard title="Bitácora de intentos de contacto">
      {attempts.length === 0 ? (
        <p className="py-2 text-sm text-ink-3">
          Sin intentos registrados. Usa «Registrar intento» para anotar el primero.
        </p>
      ) : (
        <ul>
          {attempts.map((attempt, index) => (
            <li
              key={attempt.id}
              className={
                index === 0
                  ? 'grid grid-cols-[64px_130px_1fr_auto] items-baseline gap-4 pb-3.5'
                  : 'grid grid-cols-[64px_130px_1fr_auto] items-baseline gap-4 border-t border-line py-3.5 last:pb-0'
              }
            >
              <span className="text-sm text-ink-3">{formatDayMonth(attempt.occurredAt)}</span>
              <span className="text-sm font-semibold text-ink">{attempt.channel}</span>
              <span className="text-sm text-ink-2">{attempt.outcome}</span>
              <span className="text-sm text-ink-3">{attempt.byName}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
