import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { cn, Skeleton, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'

import {
  useCreateProposalDraftMutation,
  useGetProposalHotelsQuery,
  useGetProposalWorkspaceQuery,
} from '../api/proposalsApi'
import type { ProposalHotel } from '../types/proposal.types'

import personajePago from '@/assets/ilustrations/personaje-pago-procesado.svg'
import personajePresentacion from '@/assets/ilustrations/personaje-presentacion.svg'
import personajeRetro from '@/assets/ilustrations/personaje-retroalimentacion.svg'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { SearchField } from '@/shared/components/SearchField'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatDate } from '@/shared/lib/formatters'
import { matchesSearch } from '@/shared/lib/text'

/**
 * «Ver propuesta» (Hugo, 2026-10-23): un solo lugar para cualquier hotel.
 * Antes «Nueva propuesta» solo abría la v1 de los que no tenían ninguna, y la
 * nueva versión de los demás vivía en otra pantalla: no se entendía qué pasaba
 * con las que ya existían. Aquí se elige el hotel —todos, también los que
 * todavía no pueden— y se ve su situación: seguir el borrador, abrir una nueva
 * versión, crear la primera, o por qué todavía no se puede.
 *
 * El texto se traduce al pintar con `i18n._()` (D-36).
 */
const INTRO_SLIDES: readonly {
  image: string
  title: MessageDescriptor
  text: MessageDescriptor
}[] = [
  {
    image: personajePresentacion,
    title: msg`La propuesta vive en Verde`,
    text: msg`Solo los hoteles en Verde (o Café, para renegociar) pueden abrir propuesta — y de Verde no se avanza sin enviarla.`,
  },
  {
    image: personajePago,
    title: msg`Tarifas globales, por ahora`,
    text: msg`Un pay rate y un bill rate para todo el hotel. Cotizar por posición llegará más adelante.`,
  },
  {
    image: personajeRetro,
    title: msg`Lo enviado no se edita`,
    text: msg`Cada envío congela una versión. Renegociar es abrir una nueva, que arranca con las tarifas de la anterior.`,
  },
]

/** Lo que el renglón dice de la última versión, para decidir sin abrir el hotel. */
function LastProposalHint({ hotel }: { hotel: ProposalHotel }): ReactNode {
  const last = hotel.lastProposal
  if (!last) return <Trans>Sin propuesta</Trans>
  if (last.isDraft) return <Trans>Borrador v{last.version}</Trans>
  return <Trans>v{last.version} enviada</Trans>
}

function PanelSkeleton(): ReactNode {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-4 w-40" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
      <Skeleton className="h-10 w-44" />
    </div>
  )
}

/** La situación del hotel elegido: qué tiene y qué se puede hacer. */
function HotelPanel({
  hotel,
  canCreate,
  onDone,
}: {
  hotel: ProposalHotel
  canCreate: boolean
  onDone: () => void
}): ReactNode {
  const { t } = useLingui()
  const navigate = useNavigate()
  const {
    currentData: workspace,
    isError,
    refetch,
  } = useGetProposalWorkspaceQuery(hotel.prospectId)
  const [createDraft, { isLoading: isCreating }] = useCreateProposalDraftMutation()

  function open(): void {
    onDone()
    void navigate(`/pipeline/${hotel.prospectId}/proposal`)
  }

  async function create(version: number): Promise<void> {
    try {
      await createDraft(hotel.prospectId).unwrap()
      toast.success(t`Borrador v${String(version)} abierto`)
      open()
    } catch (error) {
      toast.error(
        apiErrorMessage(error, {
          byStatus: {
            403: t`Las propuestas las elabora el BD dueño de cada hotel: pídele que la abra.`,
          },
          fallback: t`No se pudo abrir el borrador. Reintenta en unos segundos.`,
        }),
      )
    }
  }

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-sm text-red">
          <Trans>No se pudo cargar la propuesta de este hotel.</Trans>
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            void refetch()
          }}
        >
          <Trans>Reintentar</Trans>
        </Button>
      </div>
    )
  }

  if (!workspace) return <PanelSkeleton />

  const status = hotel.prospectStatus
  const statusLabel = ONBOARDING_STATUS_LABEL[status]
  /* La misma regla que el back (`proposals.service` → `assertOpen`). */
  const isWorkingState =
    status === 'GREEN' ||
    status === 'BROWN' ||
    (status === 'ORANGE' && !workspace.hasActiveContract)
  const canOpenNew = !hotel.isClosed && isWorkingState
  const draft = workspace.draft
  const versions = workspace.versions
  const nextVersion = (versions[0]?.version ?? 0) + 1

  const reason = hotel.isClosed
    ? t`El ciclo comercial de este hotel está cerrado: ya no se cotiza.`
    : status === 'ORANGE' && workspace.hasActiveContract
      ? t`Ya es cliente con contrato vigente: la propuesta no se reabre. Si cambian las tarifas, se edita el contrato.`
      : !isWorkingState
        ? t`Todavía no se puede crear: el hotel está en ${statusLabel}. La propuesta se abre cuando llega a Verde (o regresa en Café).`
        : !canCreate
          ? t`Crear o versionar la propuesta es del BD dueño del hotel.`
          : null

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-ink">{hotel.hotelName}</h3>
          <p className="text-sm text-ink-3">
            <Trans>
              {hotel.zone} · BD: {workspace.owner.name}
            </Trans>
          </p>
        </div>
        <StatusLightSoftBadge token={ONBOARDING_STATUS_TOKEN[status]} label={statusLabel} />
      </header>

      {versions.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-4 text-sm text-ink-3">
          <Trans>Este hotel todavía no tiene propuesta.</Trans>
        </p>
      ) : (
        <ul
          aria-label={t`Versiones de la propuesta`}
          className="divide-y divide-line overflow-hidden rounded-md border border-line"
        >
          {versions.slice(0, 4).map((version) => (
            <li key={version.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="text-sm font-semibold text-ink">v{version.version}</span>
              <span className="text-sm text-ink-3">
                {version.sentAt
                  ? t`Enviada ${formatDate(version.sentAt)} · ${version.byName}`
                  : t`Borrador, sin enviar`}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3">
        {draft ? (
          <Button variant="primary" onClick={open}>
            <Trans>Seguir borrador v{draft.version}</Trans>
          </Button>
        ) : (
          <>
            {versions.length > 0 && (
              <Button variant={canOpenNew && canCreate ? 'secondary' : 'primary'} onClick={open}>
                <Trans>Abrir propuesta</Trans>
              </Button>
            )}
            {canOpenNew && canCreate && (
              <Button
                variant="primary"
                disabled={isCreating}
                onClick={() => {
                  void create(nextVersion)
                }}
              >
                {isCreating ? (
                  <Trans>Abriendo…</Trans>
                ) : versions.length === 0 ? (
                  <Trans>Crear propuesta v1</Trans>
                ) : (
                  <Trans>Nueva versión (v{nextVersion})</Trans>
                )}
              </Button>
            )}
          </>
        )}
      </div>

      {!draft && reason !== null && (
        <p role="status" className="rounded-md bg-surface-2 px-3 py-2.5 text-sm text-ink-2">
          {reason}
        </p>
      )}
    </div>
  )
}

export function ViewProposalDialog({
  isOpen,
  onClose,
  canCreate,
}: {
  isOpen: boolean
  onClose: () => void
  /** `proposals:create`: sin él se ve todo, pero no se crea ni se versiona. */
  canCreate: boolean
}): ReactNode {
  const { t, i18n } = useLingui()
  const {
    data: hotels = [],
    isLoading,
    isError,
  } = useGetProposalHotelsQuery(undefined, {
    skip: !isOpen,
  })
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { isIntroOpen: showIntro, dismissIntro } = useIntroSeen('new-proposal')

  const visible = hotels.filter((hotel) => matchesSearch(search, hotel.hotelName, hotel.zone))
  const selected = hotels.find((hotel) => hotel.prospectId === selectedId) ?? null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t`Ver propuesta`}
      description={t`Elige el hotel y ves en qué va su propuesta: seguirla, abrir una nueva versión o crear la primera.`}
      className="max-w-4xl"
    >
      {showIntro ? (
        <OnboardingIntro
          slides={INTRO_SLIDES.map((slide) => ({
            image: slide.image,
            title: i18n._(slide.title),
            text: i18n._(slide.text),
          }))}
          startLabel={t`Elegir el hotel`}
          onDone={() => {
            dismissIntro()
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <SearchField
              value={search}
              onChange={setSearch}
              label={t`Buscar hotel`}
              placeholder={t`Nombre o zona, p. ej. Puerto Real…`}
            />
            {isLoading ? (
              <div aria-hidden className="flex flex-col gap-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : isError ? (
              <p role="alert" className="text-sm text-red">
                <Trans>No se pudieron cargar los hoteles. Reintenta en unos segundos.</Trans>
              </p>
            ) : visible.length === 0 ? (
              <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-sm text-ink-3">
                <Trans>Ningún hotel con ese nombre. Prueba con otra parte del nombre.</Trans>
              </p>
            ) : (
              <ul
                aria-label={t`Hoteles`}
                className="flex max-h-[26rem] flex-col gap-2 overflow-y-auto pr-1"
              >
                {visible.map((hotel) => (
                  <li key={hotel.prospectId}>
                    <button
                      type="button"
                      aria-pressed={hotel.prospectId === selectedId}
                      onClick={() => {
                        setSelectedId(hotel.prospectId)
                      }}
                      className={cn(
                        'flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
                        hotel.prospectId === selectedId
                          ? 'border-o-500 bg-o-50'
                          : 'border-line bg-surface hover:bg-surface-2',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {hotel.hotelName}
                        </span>
                        <span className="block truncate text-xs text-ink-3">
                          <LastProposalHint hotel={hotel} />
                        </span>
                      </span>
                      <StatusLightSoftBadge
                        token={ONBOARDING_STATUS_TOKEN[hotel.prospectStatus]}
                        label={ONBOARDING_STATUS_LABEL[hotel.prospectStatus]}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <section
            aria-label={t`Propuesta del hotel`}
            className="min-w-0 rounded-lg border border-line bg-surface p-4"
          >
            {selected ? (
              <HotelPanel hotel={selected} canCreate={canCreate} onDone={onClose} />
            ) : (
              <p className="py-8 text-center text-sm text-ink-3">
                <Trans>Elige un hotel de la lista para ver su propuesta.</Trans>
              </p>
            )}
          </section>
        </div>
      )}
    </Modal>
  )
}
