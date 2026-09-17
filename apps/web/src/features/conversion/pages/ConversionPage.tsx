import { Trans, useLingui } from '@lingui/react/macro'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import {
  useApproveConversionMutation,
  useCreateHotelUserMutation,
  useGetConversionReadinessQuery,
  useReturnToRenegotiationMutation,
} from '../api/conversionApi'
import { ApproveConversionDialog } from '../components/ApproveConversionDialog'
import { RequirementRow } from '../components/RequirementRow'

import personajeCronograma from '@/assets/ilustrations/personaje-cronograma.svg'
import personajeManager from '@/assets/ilustrations/personaje-manager.svg'
import personajeTratoCerrado from '@/assets/ilustrations/personaje-trato-cerrado.svg'
import { useGetStatusChangeReasonsQuery } from '@/features/onboarding'
import { Button } from '@/shared/components/Button'
import { DetailSkeleton } from '@/shared/components/DetailSkeleton'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { SectionCard } from '@/shared/components/SectionCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
  type OnboardingStatus,
} from '@/shared/constants/onboardingStatus'
import { useCan } from '@/shared/hooks/useCan'
import { IS_DEV_UI } from '@/shared/lib/devMode'

function notAwaitingState(error: unknown): OnboardingStatus | null {
  const data = (error as { data?: { error?: { code?: string; state?: string } } } | undefined)?.data
    ?.error
  if (data?.code !== 'NOT_AWAITING_CONVERSION') return null
  return (data.state as OnboardingStatus | undefined) ?? null
}

export function ConversionPage(): ReactNode {
  const { t } = useLingui()
  const { prospectId = '' } = useParams()

  const {
    data: readiness,
    isLoading,
    isError,
    error,
  } = useGetConversionReadinessQuery(prospectId, { skip: prospectId === '' })

  const [createHotelUser, { isLoading: isCreatingUser }] = useCreateHotelUserMutation()
  const [approveConversion, { isLoading: isApproving, isSuccess: isApproved }] =
    useApproveConversionMutation()
  const [returnToRenegotiation, { isLoading: isReturning, isSuccess: isReturned }] =
    useReturnToRenegotiationMutation()

  const can = useCan()
  const [isApproveOpen, setApproveOpen] = useState(false)

  /** Aprobar la conversión y crear el Usuario del Hotel son del BDC: a los demás no se les ofrecen. */
  const canApprove = can('conversion:approve')
  const canCreateHotelUser = can('conversion:create_hotel_user')

  const [actedHotelName, setActedHotelName] = useState('')
  /** Sin nombre a la mano (recarga tras aprobar), el sujeto genérico. */
  const fallbackHotel = t`El hotel`
  const fallbackProspect = t`El prospecto`

  const [isReturnOpen, setIsReturnOpen] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const { data: returnReasons = [] } = useGetStatusChangeReasonsQuery('BROWN', {
    skip: !isReturnOpen,
  })

  if (isApproved) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-6">
        <div className="flex items-center gap-3">
          <StatusLightSoftBadge token={ONBOARDING_STATUS_TOKEN.ORANGE} label={t`Naranja`} />
          <p className="text-base font-semibold text-ink">
            <Trans>{actedHotelName || fallbackHotel} ya es cliente activo</Trans>
          </p>
        </div>
        <p className="text-sm text-ink-3">
          <Trans>
            La conversión Rosa → Naranja quedó aprobada: el hotel puede generar requisiciones y el
            BD queda como su referente comercial.
          </Trans>
        </p>
        <div className="flex gap-4">
          <Link to="/active-clients" className="text-sm font-semibold text-o-700 hover:underline">
            <Trans>Ver en Clientes Activos</Trans>
          </Link>
          <Link to="/conversion" className="text-sm font-semibold text-o-700 hover:underline">
            <Trans>Volver a Conversión</Trans>
          </Link>
        </div>
      </div>
    )
  }

  if (isReturned) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-6">
        <div className="flex items-center gap-3">
          <StatusLightSoftBadge token={ONBOARDING_STATUS_TOKEN.BROWN} label={t`Café`} />
          <p className="text-base font-semibold text-ink">
            <Trans>{actedHotelName || fallbackProspect} volvió a renegociación</Trans>
          </p>
        </div>
        <p className="text-sm text-ink-3">
          <Trans>
            El ciclo sigue vivo en Café: se retoma desde el Pipeline cuando el hotel se desbloquee.
          </Trans>
        </p>
        <Link to="/conversion" className="text-sm font-semibold text-o-700 hover:underline">
          <Trans>Volver a Conversión</Trans>
        </Link>
      </div>
    )
  }

  if (isLoading) return <DetailSkeleton />

  if (isError || !readiness) {
    const state = notAwaitingState(error)
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-6">
        {state === 'ORANGE' ? (
          <NoticeCard image={personajeTratoCerrado} title={t`Este hotel ya es cliente activo`}>
            <Trans>Su conversión ya se aprobó: no hay nada que convertir.</Trans>
          </NoticeCard>
        ) : state ? (
          <NoticeCard image={personajeCronograma} title={t`Todavía no toca convertir`}>
            <Trans>
              Este prospecto está en{' '}
              <span className="font-semibold">{ONBOARDING_STATUS_LABEL[state]}</span> — la
              conversión sale de Rosa
            </Trans>
            {IS_DEV_UI ? ' (RR-V-02)' : ''}.
          </NoticeCard>
        ) : (
          <p className="text-sm text-red">
            <Trans>
              No se pudo cargar la conversión de este hotel. Recarga la página para reintentar.
            </Trans>
          </p>
        )}
        <Link to="/conversion" className="text-sm font-semibold text-o-700 hover:underline">
          <Trans>Volver a Conversión</Trans>
        </Link>
      </div>
    )
  }

  const isBusy = isCreatingUser || isApproving || isReturning

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <Trans>Conversión a cliente activo</Trans>
          </h1>
          <StatusLightSoftBadge
            token={ONBOARDING_STATUS_TOKEN[readiness.currentStatus]}
            label={ONBOARDING_STATUS_LABEL[readiness.currentStatus]}
          />
        </div>
        <p className="mt-1.5 text-sm text-ink-3">
          {readiness.hotelName} · {ONBOARDING_STATUS_LABEL[readiness.currentStatus]} →{' '}
          {ONBOARDING_STATUS_LABEL[readiness.targetStatus]} · {readiness.approvalNote}
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard title={t`Requisitos para habilitar la conversión`}>
          {readiness.requirements.length === 0 ? (
            <p className="py-2 text-sm text-ink-3">
              {readiness.blockedReason ?? t`Sin requisitos pendientes.`}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {readiness.requirements.map((requirement) => (
                <RequirementRow
                  key={requirement.id}
                  requirement={canCreateHotelUser ? requirement : { ...requirement, action: null }}
                  isActing={isCreatingUser}
                  onAct={() => {
                    if (!readiness.hotelUserDraft) return
                    void createHotelUser({
                      prospectId,
                      hotelId: readiness.hotelId,
                      email: readiness.hotelUserDraft.email,
                      fullName: readiness.hotelUserDraft.fullName,
                    })
                      .unwrap()
                      .then(() => {
                        toast.success(t`Cuenta del hotel creada`)
                      })
                      .catch(() => {})
                  }}
                />
              ))}
            </ul>
          )}

          {canApprove ? (
            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <Button
                disabled={isBusy}
                onClick={() => {
                  setIsReturnOpen((open) => !open)
                }}
              >
                <Trans>Devolver a Café</Trans>
              </Button>

              {/* Convertir no se hace al primer clic: el diálogo enseña el
                  hotel y lo que va a cambiar antes de que no haya vuelta. */}
              <Button
                variant="primary"
                disabled={!readiness.canApprove || isBusy}
                title={readiness.blockedReason ?? undefined}
                onClick={() => {
                  setApproveOpen(true)
                }}
              >
                {isApproving ? t`Aprobando…` : t`Aprobar conversión`}
              </Button>
            </div>
          ) : (
            <div className="mt-6">
              <NoticeCard
                image={personajeManager}
                title={t`La aprobación es del BDC`}
                role="status"
              >
                <Trans>
                  Aprobar la conversión Rosa → Naranja —o devolverla a Café— es del BDC. Cuando la
                  apruebe, el hotel queda como cliente activo y puede generar requisiciones.
                </Trans>
              </NoticeCard>
            </div>
          )}

          {isReturnOpen && (
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3 rounded-md bg-surface-2 p-3">
              <label htmlFor="returnReason" className="text-sm text-ink-2">
                <Trans>Motivo del regreso (obligatorio):</Trans>
              </label>
              <span className="w-64">
                <Select
                  {...(returnReason ? { value: returnReason } : {})}
                  onValueChange={setReturnReason}
                >
                  <SelectTrigger id="returnReason" className="w-full">
                    <SelectValue placeholder={t`Elige un motivo…`} />
                  </SelectTrigger>
                  <SelectContent>
                    {returnReasons.map((reason) => (
                      <SelectItem key={reason.id} value={reason.id}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </span>
              <Button
                disabled={returnReason === '' || isBusy}
                onClick={() => {
                  setActedHotelName(readiness.hotelName)
                  void returnToRenegotiation({ prospectId, reasonCode: returnReason })
                    .unwrap()
                    .then(() => {
                      toast.success(t`Devuelto a Café`)
                    })
                    .catch(() => {})
                }}
              >
                {isReturning ? t`Devolviendo…` : t`Confirmar regreso`}
              </Button>
            </div>
          )}

          {readiness.blockedReason !== null && (
            <p className="mt-3 text-right text-sm text-ink-3">{readiness.blockedReason}</p>
          )}
        </SectionCard>

        <SectionCard title={t`Qué pasa al aprobar`}>
          <ul className="flex flex-col gap-3">
            {readiness.effects.map((effect) => (
              <li key={effect} className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-o-500" aria-hidden />
                <span className="text-sm leading-relaxed text-ink-2">{effect}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <ApproveConversionDialog
        isOpen={isApproveOpen}
        onClose={() => {
          setApproveOpen(false)
        }}
        isApproving={isApproving}
        readiness={readiness}
        onConfirm={() => {
          setActedHotelName(readiness.hotelName)
          void approveConversion(prospectId)
            .unwrap()
            .then(() => {
              setApproveOpen(false)
              toast.success(t`Conversión aprobada`)
            })
            .catch(() => {
              setApproveOpen(false)
            })
        }}
      />
    </div>
  )
}
