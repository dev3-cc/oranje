import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { cn, MaterialIcon } from '@oranje/ui'
import { useMemo, useState, type ReactNode } from 'react'

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
import { SearchField } from '@/shared/components/SearchField'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { useCan } from '@/shared/hooks/useCan'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { formatDate } from '@/shared/lib/formatters'

export function ProposalListPage(): ReactNode {
  const { t } = useLingui()
  /** El nombre va al servidor (Hugo, 2026-10-21): `/prospects` ya lo soporta
      — se espera a que se deje de teclear, igual que el Pool. */
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounce(searchInput)
  const appliedArg = useMemo(() => ({ search }), [search])
  const {
    data: candidates = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetProposalCandidatesQuery(appliedArg)
  const [isCreating, setIsCreating] = useState(false)
  const can = useCan()
  /** Solo el BD elabora propuestas (proposals:create): a los demás no se les ofrece el botón. */
  const canCreate = can('proposals:create')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /* Las 3 columnas juntas (lista + formulario + vista previa) se veían
     apretadas (Hugo, 2026-10-19): la lista se puede contraer a una franja
     angosta para darle el ancho a las otras dos. Solo en escritorio — en
     angosto la lista ya es una tira horizontal, no compite por ancho. */
  const [isListCollapsed, setIsListCollapsed] = useState(false)
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
              : t`${plural(candidates.length, { one: '# hotel con propuesta', other: '# hoteles con propuesta' })} · cada una se edita desde la ficha del hotel`}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <SearchField
              isSearching={isFetching && search.trim() !== ''}
              value={searchInput}
              onChange={setSearchInput}
              label={t`Buscar hotel`}
              placeholder={t`Nombre del hotel, p. ej. Puerto Real…`}
              className="w-full max-w-md"
            />
            {canCreate ? (
              <Button
                variant="primary"
                onClick={() => {
                  setIsCreating(true)
                }}
              >
                <Trans>Nueva propuesta</Trans>
              </Button>
            ) : null}
          </div>
        </div>
        <img
          src={fotoEquipo}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-2 -bottom-1 hidden h-[calc(100%+2.5rem)] w-auto object-contain object-bottom drop-shadow-[0_10px_18px_rgba(60,30,0,0.26)] md:block"
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

      {!isLoading && !isError && candidates.length === 0 && searchInput.trim() !== '' && (
        <EmptyState
          title={t`Ningún hotel con ese nombre`}
          text={t`Prueba con otra parte del nombre, o quita la búsqueda.`}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSearchInput('')
              }}
            >
              <Trans>Quitar búsqueda</Trans>
            </Button>
          }
        />
      )}

      {!isLoading && !isError && candidates.length === 0 && searchInput.trim() === '' && (
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
        <>
          {/* Arriba de las dos columnas, no adentro de la lista: así no le
              quita alto a las tarjetas (Hugo, 2026-10-19: "sube el botón...
              para que dé más espacio"). Solo en escritorio. */}
          <button
            type="button"
            onClick={() => {
              setIsListCollapsed((collapsed) => !collapsed)
            }}
            aria-expanded={!isListCollapsed}
            className="hidden w-fit cursor-pointer items-center gap-1.5 self-start rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium whitespace-nowrap text-ink-3 transition-colors hover:bg-surface-2 hover:text-o-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500 lg:flex"
          >
            <MaterialIcon
              name={isListCollapsed ? 'chevron_right' : 'chevron_left'}
              className="text-lg"
              aria-hidden
            />
            {isListCollapsed ? t`Ver lista de propuestas` : t`Cerrar lista de propuestas`}
          </button>

          {/* Lista a la izquierda, la propuesta del hotel elegido a la derecha (como Contratos). */}
          <div
            className={cn(
              'grid grid-cols-1 items-start gap-5 transition-[grid-template-columns] duration-200',
              /* Con la lista oculta (`display:none`, no `visibility`) deja de
                 contar para el grid: si aquí se dejaran dos columnas (una en
                 0), el panel de la derecha — ya el único hijo — se
                 auto-colocaría en la PRIMERA (la de ancho 0), no en la
                 segunda, y se vería todo en blanco (Hugo, 2026-10-19, lo vio
                 en vivo). Con una sola columna no hay a dónde más ir. */
              isListCollapsed ? 'lg:grid-cols-1' : 'lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]',
            )}
          >
            {/* En angosto: tira horizontal sobre la propuesta; en ancho, columna lateral. */}
            <ul
              className={cn(
                '-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0',
                isListCollapsed && 'lg:hidden',
              )}
            >
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
        </>
      )}
    </div>
  )
}
