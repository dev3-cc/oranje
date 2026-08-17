import type { ReactNode } from 'react'

import type { ProspectSummary } from '../types/prospect.types'

import { ProspectCard } from './ProspectCard'

import { SemaforoSoftBadge } from '@/shared/components/SemaforoSoftBadge'
import {
  ONBOARDING_STATUS_DESCRIPTION,
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
  type OnboardingStatus,
} from '@/shared/constants/onboardingStatus'

/**
 * Columna del tablero. `self-start` a propósito: la altura la da su contenido,
 * como en el diseño, en vez de estirarse a la de la columna más larga.
 *
 * El chip va en variante suave, no sólida: son cuatro o seis a la vez y el
 * relleno lleno compite con las tarjetas, que es lo que hay que leer.
 */
export function PipelineColumn({
  status,
  prospects,
}: {
  status: OnboardingStatus
  prospects: ProspectSummary[]
}): ReactNode {
  return (
    <section className="flex w-80 shrink-0 flex-col gap-3 self-start rounded-lg bg-surface-3/60 p-3">
      <header className="flex items-center justify-between gap-3 px-1 pt-1">
        <SemaforoSoftBadge
          token={ONBOARDING_STATUS_TOKEN[status]}
          label={ONBOARDING_STATUS_LABEL[status]}
        />
        <span className="text-sm font-semibold text-ink-3">{prospects.length}</span>
      </header>

      <p className="px-1 text-sm text-ink-3">{ONBOARDING_STATUS_DESCRIPTION[status]}</p>

      {prospects.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-sm text-ink-4">
          Sin prospectos
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {prospects.map((prospect) => (
            <ProspectCard key={prospect.id} prospect={prospect} />
          ))}
        </div>
      )}
    </section>
  )
}
