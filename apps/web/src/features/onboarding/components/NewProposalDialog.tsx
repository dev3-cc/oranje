import { toast } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { useCreateProposalDraftMutation, useGetProposalTargetsQuery } from '../api/proposalsApi'

import personajePago from '@/assets/ilustrations/personaje-pago-procesado.svg'
import personajePresentacion from '@/assets/ilustrations/personaje-presentacion.svg'
import personajeRetro from '@/assets/ilustrations/personaje-retroalimentacion.svg'
import { Button } from '@/shared/components/Button'
import { EmptyState } from '@/shared/components/EmptyState'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { apiErrorMessage } from '@/shared/lib/apiError'

/**
 * Abrir la primera propuesta de un hotel SIN pasar por su ficha: se elige el
 * prospecto (solo Verde o Café sin propuesta, la regla del back) y el borrador
 * v1 se crea al momento — el detalle se sigue trabajando en su workspace.
 */
const INTRO_SLIDES = [
  {
    image: personajePresentacion,
    title: 'La propuesta vive en Verde',
    text: 'Solo los hoteles en Verde (o Café, para renegociar) pueden abrir propuesta — y de Verde no se avanza sin enviarla.',
  },
  {
    image: personajePago,
    title: 'Tarifas globales, por ahora',
    text: 'Un pay rate y un bill rate para todo el hotel. Cotizar por posición llegará más adelante.',
  },
  {
    image: personajeRetro,
    title: 'Lo enviado no se edita',
    text: 'Cada envío congela una versión. Renegociar es abrir una nueva, que arranca con las tarifas de la anterior.',
  },
] as const

export function NewProposalDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}): ReactNode {
  const navigate = useNavigate()
  const { data: targets = [], isLoading } = useGetProposalTargetsQuery(undefined, {
    skip: !isOpen,
  })
  const [createDraft, { isLoading: isCreating, isError, error }] = useCreateProposalDraftMutation()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const { isIntroOpen: showIntro, dismissIntro } = useIntroSeen('new-proposal')

  useEffect(() => {}, [isOpen])

  async function start(prospectId: string): Promise<void> {
    setPendingId(prospectId)
    try {
      await createDraft(prospectId).unwrap()
      toast.success('Borrador v1 abierto')
      onClose()
      void navigate(`/pipeline/${prospectId}/propuesta`)
    } catch {
      setPendingId(null)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva propuesta"
      description="Elige el hotel: se abre su borrador v1 y pasas directo a cotizarlo."
    >
      {showIntro ? (
        <OnboardingIntro
          slides={INTRO_SLIDES}
          startLabel="Elegir el hotel"
          onDone={() => {
            dismissIntro()
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {isError && (
            <p role="alert" className="text-sm text-red">
              {apiErrorMessage(error, {
                byStatus: {
                  403: 'Las propuestas las elabora el BD dueño de cada prospecto: pídele que la abra.',
                },
                fallback:
                  'No se pudo abrir el borrador. Revisa que el hotel siga en Verde e inténtalo de nuevo.',
              })}
            </p>
          )}

          {isLoading && <p className="p-4 text-sm text-ink-3">Buscando hoteles en Verde…</p>}

          {!isLoading && targets.length === 0 && (
            <EmptyState
              title="Ningún hotel espera propuesta"
              text="La propuesta se abre cuando un prospecto está en Verde (o vuelve en Café) y todavía no tiene una. Los hoteles que ya tienen propuesta se siguen desde su fila de la lista."
              action={
                <Button variant="secondary" onClick={onClose}>
                  Cerrar
                </Button>
              }
            />
          )}

          <ul className="flex flex-col gap-2">
            {targets.map((target) => (
              <li key={target.prospectId}>
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={() => {
                    void start(target.prospectId)
                  }}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-md border border-line bg-surface p-4 text-left transition-colors hover:border-o-500 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500 disabled:cursor-wait disabled:opacity-60"
                >
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-ink">{target.hotelName}</p>
                    <p className="mt-0.5 text-sm text-ink-3">{target.zone}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusLightSoftBadge
                      token={ONBOARDING_STATUS_TOKEN[target.prospectStatus]}
                      label={ONBOARDING_STATUS_LABEL[target.prospectStatus]}
                    />
                    <span className="text-sm font-medium text-o-700">
                      {isCreating && pendingId === target.prospectId ? 'Abriendo…' : 'Cotizar →'}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}
