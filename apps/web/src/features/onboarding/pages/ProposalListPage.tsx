import { useState, type ReactNode } from 'react'

import { useGetProposalCandidatesQuery } from '../api/proposalsApi'
import { NewProposalDialog } from '../components/NewProposalDialog'

import { ProposalEditorPage } from './ProposalEditorPage'

import { Button } from '@/shared/components/Button'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { DetailSkeleton } from '@/shared/components/DetailSkeleton'
import { EmptyState } from '@/shared/components/EmptyState'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { MagicCard } from '@/shared/components/MagicCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { useCan } from '@/shared/hooks/useCan'
import { formatDate } from '@/shared/lib/formatters'

export function ProposalListPage(): ReactNode {
  const { data: candidates = [], isLoading, isError, refetch } = useGetProposalCandidatesQuery()
  const [isCreating, setIsCreating] = useState(false)
  const can = useCan()
  /** Solo el BD elabora propuestas (proposals:create): a los demás no se les ofrece el botón. */
  const canCreate = can('proposals:create')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** Siempre hay una propuesta abierta: la elegida o la primera de la lista. */
  const selected = candidates.find((c) => c.prospectId === selectedId) ?? candidates[0] ?? null

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
        {canCreate ? (
          <Button
            variant="primary"
            onClick={() => {
              setIsCreating(true)
            }}
          >
            Nueva propuesta
          </Button>
        ) : null}
      </header>

      <NewProposalDialog
        isOpen={isCreating}
        onClose={() => {
          setIsCreating(false)
        }}
      />

      {isLoading && (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <CardGridSkeleton cards={5} className="grid-cols-1" />
          <DetailSkeleton />
        </div>
      )}

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
            canCreate ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setIsCreating(true)
                }}
              >
                Nueva propuesta
              </Button>
            ) : undefined
          }
        />
      )}

      {candidates.length > 0 && (
        /* Lista a la izquierda, la propuesta del hotel elegido a la derecha (como Documentos T&C). */
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          {/* En angosto: tira horizontal sobre la propuesta; en ancho, columna lateral. */}
          <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
            {candidates.map((candidate) => {
              const isSelected = candidate.prospectId === selected?.prospectId
              return (
                <li key={candidate.prospectId} className="w-72 shrink-0 snap-start lg:w-auto">
                  <MagicCard className="rounded-xl">
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedId(candidate.prospectId)
                      }}
                      className={`w-full cursor-pointer touch-manipulation rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500 ${isSelected ? 'border-o-500 bg-o-50' : 'border-line bg-surface hover:bg-surface-2'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink">
                            {candidate.hotelName}
                          </span>
                          <span className="block truncate text-xs text-ink-3">
                            {candidate.zone}
                          </span>
                        </span>
                        <StatusLightSoftBadge
                          token={ONBOARDING_STATUS_TOKEN[candidate.prospectStatus]}
                          label={ONBOARDING_STATUS_LABEL[candidate.prospectStatus]}
                        />
                      </div>
                      <p className="mt-2 text-xs text-ink-3">
                        v{candidate.latestVersion} ·{' '}
                        {candidate.latestSentAt
                          ? `Enviada ${formatDate(candidate.latestSentAt)}`
                          : 'Borrador sin enviar'}
                      </p>
                    </button>
                  </MagicCard>
                </li>
              )
            })}
          </ul>

          {selected && <ProposalEditorPage prospectId={selected.prospectId} embedded />}
        </div>
      )}
    </div>
  )
}
