import { Trans, useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { StaleProspect } from '../types/dashboard.types'

import { SectionCard } from '@/shared/components/SectionCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'

export function StaleProspectList({ prospects }: { prospects: StaleProspect[] }): ReactNode {
  const { t } = useLingui()
  return (
    <SectionCard
      title={t`Sin actividad reciente`}
      subtitle={
        IS_DEV_UI
          ? 'Último contact_attempt hace 7+ días'
          : t`Sin intento de contacto en 7 días o más`
      }
    >
      {prospects.length === 0 ? (
        <p className="py-2 text-sm text-ink-3">
          <Trans>Ningún prospecto lleva más de 7 días sin un intento de contacto.</Trans>
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {prospects.map((prospect) => (
            <li key={prospect.prospectId} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Link
                  to={`/pipeline/${prospect.prospectId}`}
                  className="text-sm font-semibold text-ink hover:text-o-700"
                >
                  {prospect.hotelName}
                </Link>
                <p className="mt-1 text-sm text-ink-3">
                  <Trans>{prospect.daysWithoutAttempt} d sin intento</Trans>
                </p>
              </div>

              <StatusLightSoftBadge
                token={ONBOARDING_STATUS_TOKEN[prospect.status]}
                label={ONBOARDING_STATUS_LABEL[prospect.status]}
              />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
