import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { useGetConversionQueueQuery } from '../api/conversionApi'

import { SemaforoSoftBadge } from '@/shared/components/SemaforoSoftBadge'
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
  const { data: candidates = [], isLoading, isError } = useGetConversionQueueQuery()

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Conversión</h1>
        <p className="mt-1.5 text-sm text-ink-3">
          {isLoading
            ? 'Cargando la cola…'
            : `${candidates.length} prospectos en Rosa esperando aprobación`}
        </p>
      </header>

      {isError && (
        <p className="rounded-lg border border-line bg-surface p-6 text-sm text-red">
          No se pudo cargar la cola de conversión. Reintenta en unos segundos.
        </p>
      )}

      {!isLoading && !isError && candidates.length === 0 && (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
          Nada por convertir: ningún prospecto llegó a Rosa todavía.
        </p>
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
                  <SemaforoSoftBadge
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
