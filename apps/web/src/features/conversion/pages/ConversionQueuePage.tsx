import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { useGetConversionQueueQuery, useGetRecentConversionsQuery } from '../api/conversionApi'

import conversionIllustration from '@/assets/ilustrations/conversion_naranja.svg'
import { ProspectCard } from '@/features/onboarding'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
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
  const { data: recent = [] } = useGetRecentConversionsQuery()

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

      {isLoading && <CardGridSkeleton cards={3} className="grid-cols-1 md:grid-cols-2" />}

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

      {/* La memoria de la pantalla: lo último que se aprobó, con la MISMA
          tarjeta del Pipeline — tocarla abre la ficha del hotel. */}
      {recent.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-ink">Aprobados recientemente</h2>
              <p className="mt-0.5 text-sm text-ink-3">
                Ya son clientes: su ficha completa vive en Clientes Activos
              </p>
            </div>
            <Link
              to="/clientes-activos"
              className="min-h-11 shrink-0 touch-manipulation content-center text-sm font-semibold text-o-700 underline-offset-4 hover:underline"
            >
              Ver Clientes Activos
            </Link>
          </div>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(16rem,22rem))]">
            {recent.map((prospect) => (
              <ProspectCard key={prospect.id} prospect={prospect} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
