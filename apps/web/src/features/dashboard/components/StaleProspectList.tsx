import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { StaleProspect } from '../types/dashboard.types'

import { SectionCard } from '@/shared/components/SectionCard'
import { SemaforoSoftBadge } from '@/shared/components/SemaforoSoftBadge'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'

/**
 * Prospectos que llevan demasiado sin un intento de contacto.
 *
 * El nombre es un enlace a su ficha: esta tarjeta existe para que alguien haga
 * algo con ellos, y obligar a buscarlos otra vez en el tablero sería trabajo de
 * más. La maqueta no lo dibuja como enlace, pero es la acción evidente.
 */
export function StaleProspectList({ prospects }: { prospects: StaleProspect[] }): ReactNode {
  return (
    <SectionCard title="Sin actividad reciente" subtitle="Último contact_attempt hace 7+ días">
      {prospects.length === 0 ? (
        <p className="py-2 text-sm text-ink-3">
          Ningún prospecto lleva más de 7 días sin un intento. Bien ahí.
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
                  {prospect.daysWithoutAttempt} d sin intento
                </p>
              </div>

              <SemaforoSoftBadge
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
