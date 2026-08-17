import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { useGetProposalCandidatesQuery } from '../api/proposalsApi'

import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { formatDate } from '@/shared/lib/formatters'

/**
 * Módulo Propuestas: vista transversal de los hoteles que tienen alguna.
 *
 * Es de SOLO LECTURA. Crear versiones y editarlas vive dentro de cada hotel del
 * pipeline, y cada fila lleva justo ahí. Duplicar aquí el editor sería tener dos
 * sitios donde cambiar lo mismo.
 *
 * ⚠ Esta pantalla NO tiene maqueta. Se armó reusando las formas que ya existen
 * en Pipeline y Mi Territorio, sin inventar patrones nuevos. Se rehace cuando
 * llegue su diseño.
 *
 * Vive en `features/onboarding` y no en una feature propia porque comparte los
 * datos y el contrato con la propuesta del hotel; §4 pide una carpeta por
 * módulo del sidebar, pero partir la propuesta en dos features obligaría a
 * duplicar sus tipos.
 */
export function ProposalListPage(): ReactNode {
  const { data: candidates = [], isLoading, isError } = useGetProposalCandidatesQuery()

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Propuestas</h1>
        <p className="mt-1.5 text-sm text-ink-3">
          {isLoading
            ? 'Cargando propuestas…'
            : `${candidates.length} hoteles con propuesta · se editan desde su ficha`}
        </p>
      </header>

      {isError && (
        <p className="rounded-lg border border-line bg-surface p-6 text-sm text-red">
          No se pudieron cargar las propuestas. Reintenta en unos segundos.
        </p>
      )}

      {!isLoading && !isError && candidates.length === 0 && (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
          Todavía no se ha cotizado ningún hotel. Las propuestas se abren desde la ficha del
          prospecto.
        </p>
      )}

      {candidates.length > 0 && (
        <ul className="flex flex-col gap-3">
          {candidates.map((candidate) => (
            <li key={candidate.prospectId}>
              <Link
                to={`/pipeline/${candidate.prospectId}/propuesta`}
                className="flex items-center justify-between gap-4 rounded-md border border-line bg-surface p-4 transition-colors hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold text-ink">{candidate.hotelName}</p>
                  <p className="mt-1 text-sm text-ink-3">{candidate.zone}</p>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink">v{candidate.latestVersion}</p>
                    <p className="mt-1 text-sm text-ink-3">
                      {candidate.latestSentAt
                        ? `Enviada ${formatDate(candidate.latestSentAt)}`
                        : 'Borrador sin enviar'}
                    </p>
                  </div>
                  <StatusLightSoftBadge
                    token={ONBOARDING_STATUS_TOKEN[candidate.prospectStatus]}
                    label={ONBOARDING_STATUS_LABEL[candidate.prospectStatus]}
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
