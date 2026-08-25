import { statusLight } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { FunnelBucket } from '../types/dashboard.types'

import { SectionCard } from '@/shared/components/SectionCard'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'

export function StatusFunnel({ buckets }: { buckets: FunnelBucket[] }): ReactNode {
  const highest = Math.max(...buckets.map((bucket) => bucket.count), 1)

  return (
    <SectionCard
      title="Embudo por estado"
      subtitle={
        IS_DEV_UI ? 'prospect.onboarding_state_id — solo ciclos abiertos' : 'Solo ciclos abiertos'
      }
    >
      {buckets.length === 0 ? (
        <p className="py-2 text-sm text-ink-3">Sin prospectos abiertos en el periodo.</p>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {buckets.map((bucket) => {
            const label = ONBOARDING_STATUS_LABEL[bucket.status]

            return (
              <li key={bucket.status} className="flex items-center gap-4">
                <span className="w-24 shrink-0 text-sm text-ink-2">{label}</span>

                <div
                  className="h-7 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-3/60"
                  role="img"
                  aria-label={`${label}: ${bucket.count} prospectos`}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${((bucket.count / highest) * 100).toFixed(1)}%`,
                      backgroundColor: statusLight[ONBOARDING_STATUS_TOKEN[bucket.status]],
                    }}
                  />
                </div>

                <span className="w-7 shrink-0 text-right text-sm text-ink-2">{bucket.count}</span>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}
