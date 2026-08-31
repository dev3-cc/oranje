import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { useGetProposalCandidatesQuery } from '../api/proposalsApi'
import { NewProposalDialog } from '../components/NewProposalDialog'

import { Button } from '@/shared/components/Button'
import { EmptyState } from '@/shared/components/EmptyState'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { LoadingState } from '@/shared/components/LoadingState'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { formatDate } from '@/shared/lib/formatters'

export function ProposalListPage(): ReactNode {
  const { data: candidates = [], isLoading, isError, refetch } = useGetProposalCandidatesQuery()
  const [isCreating, setIsCreating] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text="Propuestas" />
          </h1>
          <p className="mt-1.5 text-sm text-ink-3">
            {isLoading
              ? 'Cargando propuestas…'
              : `${candidates.length} hoteles con propuesta · cada una se edita desde la ficha del hotel`}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setIsCreating(true)
          }}
        >
          Nueva propuesta
        </Button>
      </header>

      <NewProposalDialog
        isOpen={isCreating}
        onClose={() => {
          setIsCreating(false)
        }}
      />

      {isLoading && <LoadingState label="Cargando las propuestas…" />}

      {isError && (
        <LoadError
          message="No se pudieron cargar las propuestas. Reintenta en unos segundos."
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {!isLoading && !isError && candidates.length === 0 && (
        <EmptyState
          title="Aún no hay propuestas"
          text="La propuesta se abre cuando un prospecto llega a Verde. Crea la primera con «Nueva propuesta» o desde la ficha del prospecto."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setIsCreating(true)
              }}
            >
              Nueva propuesta
            </Button>
          }
        />
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
