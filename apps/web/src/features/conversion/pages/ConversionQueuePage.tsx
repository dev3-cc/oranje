import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { useGetConversionQueueQuery } from '../api/conversionApi'

import conversionIllustration from '@/assets/ilustrations/conversion_naranja.svg'
import { EmptyState } from '@/shared/components/EmptyState'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { formatDaysInStatus } from '@/shared/lib/formatters'

/**
 * Cola de conversión: prospectos en Rosa esperando la aprobación del BDC.
 *
 * ⚠ Esta pantalla NO tiene maqueta. La que llegó es la de un prospecto
 * concreto, y hacía falta una entrada al módulo desde el sidebar. Se armó con
 * las formas que ya existen y se rehace cuando llegue su diseño.
 */
export function ConversionQueuePage(): ReactNode {
  const { data: candidates = [], isLoading, isError, refetch } = useGetConversionQueueQuery()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text="Conversión" />
          </h1>
          <p className="mt-1.5 text-sm text-ink-3">
            {isLoading
              ? 'Cargando la cola…'
              : `${candidates.length} prospectos en Rosa esperando aprobación`}
          </p>
        </div>
        <img
          src={conversionIllustration}
          alt=""
          aria-hidden
          className="hidden h-20 w-auto sm:block"
        />
      </header>

      {isError && (
        <LoadError
          message="No se pudo cargar la cola de Conversión. Reintenta en unos segundos."
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {!isLoading && !isError && candidates.length === 0 && (
        <EmptyState
          title="Nada por convertir"
          text="Ningún prospecto llegó a Rosa todavía. Un hotel entra aquí cuando su Documento de T&C se negocia y el BD lo mueve a Rosa en el Pipeline; entonces el BDC aprueba la conversión."
        />
      )}

      {candidates.length > 0 && (
        <ul className="flex flex-col gap-3">
          {candidates.map((candidate) => (
            <li key={candidate.prospectId}>
              <Link
                to={`/conversion/${candidate.prospectId}`}
                className="flex items-center justify-between gap-4 rounded-md border border-line bg-surface p-4 transition-colors hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold text-ink">{candidate.hotelName}</p>
                  <p className="mt-1 text-sm text-ink-3">
                    {candidate.zone} · {formatDaysInStatus(candidate.daysInStatus)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <p className="text-sm text-ink-2">
                    {candidate.pendingRequirements === 0
                      ? 'Listo para aprobar'
                      : `${candidate.pendingRequirements} requisitos pendientes`}
                  </p>
                  <StatusLightSoftBadge
                    token={ONBOARDING_STATUS_TOKEN[candidate.status]}
                    label={ONBOARDING_STATUS_LABEL[candidate.status]}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
