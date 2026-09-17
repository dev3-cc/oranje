import { Trans, useLingui } from '@lingui/react/macro'
import { useState, type ReactNode } from 'react'

import { useGetProposalCandidatesQuery } from '../api/proposalsApi'
import { NewProposalDialog } from '../components/NewProposalDialog'

import { ProposalEditorPage } from './ProposalEditorPage'

import fotoEquipo from '@/assets/ilustrations/propuestas-equipo.webp'
import { Button } from '@/shared/components/Button'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { DetailSkeleton } from '@/shared/components/DetailSkeleton'
import { EmptyState } from '@/shared/components/EmptyState'
import { FoldText } from '@/shared/components/FoldText'
import { HotelThumbnail } from '@/shared/components/HotelThumbnail'
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
  const { t } = useLingui()
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
      {/* Misma cabecera-tarjeta que Conversión y Contratos: título a la
          izquierda, la foto del equipo (recortada, sin fondo) sentada en el
          borde inferior y sobresaliendo por arriba; el `clip-path` de la
          tarjeta la recorta con las esquinas redondeadas y deja 3rem arriba.
          El botón de crear baja al bloque de texto. */}
      <header className="relative flex items-end justify-between gap-4 rounded-2xl border border-line bg-gradient-to-r from-o-50 via-surface to-surface px-6 pt-5 pb-5 [clip-path:inset(-3rem_0_0_0_round_1rem)] sm:mt-8 sm:min-h-44 sm:pr-80">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text={t`Propuestas`} />
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-ink-3">
            {isLoading
              ? t`Cargando propuestas…`
              : t`${candidates.length} hoteles con propuesta · cada una se edita desde la ficha del hotel`}
          </p>
          {canCreate ? (
            <div className="mt-4">
              <Button
                variant="primary"
                onClick={() => {
                  setIsCreating(true)
                }}
              >
                <Trans>Nueva propuesta</Trans>
              </Button>
            </div>
          ) : null}
        </div>
        <img
          src={fotoEquipo}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-2 -bottom-1 hidden h-[calc(100%+2.5rem)] w-auto object-contain object-bottom drop-shadow-[0_10px_18px_rgba(60,30,0,0.26)] sm:block"
        />
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
          message={t`No se pudieron cargar las propuestas. Reintenta en unos segundos.`}
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {!isLoading && !isError && candidates.length === 0 && (
        <EmptyState
          title={t`Aún no hay propuestas`}
          text={t`La propuesta se abre cuando un prospecto llega a Verde. Crea la primera con «Nueva propuesta» o desde la ficha del prospecto.`}
          action={
            canCreate ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setIsCreating(true)
                }}
              >
                <Trans>Nueva propuesta</Trans>
              </Button>
            ) : undefined
          }
        />
      )}

      {candidates.length > 0 && (
        /* Lista a la izquierda, la propuesta del hotel elegido a la derecha (como Contratos). */
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
                      <div className="flex items-center gap-3">
                        <HotelThumbnail photoUrl={candidate.hotelPhotoUrl} />
                        <span className="min-w-0 flex-1">
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
                        <Trans>
                          v{candidate.latestVersion} ·{' '}
                          {candidate.latestSentAt
                            ? t`Enviada ${formatDate(candidate.latestSentAt)}`
                            : t`Borrador sin enviar`}
                        </Trans>
                      </p>
                    </button>
                  </MagicCard>
                </li>
              )
            })}
          </ul>

          {selected && (
            /* Detalle fijo mientras la lista baja (lista-detalle, como el Pool y la Cartera). */
            <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-var(--hd)-3rem)] lg:overflow-y-auto">
              <ProposalEditorPage prospectId={selected.prospectId} embedded />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
