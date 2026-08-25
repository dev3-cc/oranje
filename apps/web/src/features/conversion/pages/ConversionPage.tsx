import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import {
  useApproveConversionMutation,
  useCreateHotelUserMutation,
  useGetConversionReadinessQuery,
  useReturnToRenegotiationMutation,
} from '../api/conversionApi'
import { RequirementRow } from '../components/RequirementRow'

import { useGetStatusChangeReasonsQuery } from '@/features/onboarding'
import { Button } from '@/shared/components/Button'
import { DetailSkeleton } from '@/shared/components/DetailSkeleton'
import { SectionCard } from '@/shared/components/SectionCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
  type OnboardingStatus,
} from '@/shared/constants/onboardingStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'

function notAwaitingState(error: unknown): OnboardingStatus | null {
  const data = (error as { data?: { error?: { code?: string; state?: string } } } | undefined)?.data
    ?.error
  if (data?.code !== 'NOT_AWAITING_CONVERSION') return null
  return (data.state as OnboardingStatus | undefined) ?? null
}

export function ConversionPage(): ReactNode {
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

  const [actedHotelName, setActedHotelName] = useState('')

  const [isReturnOpen, setIsReturnOpen] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const { data: returnReasons = [] } = useGetStatusChangeReasonsQuery('BROWN', {
    skip: !isReturnOpen,
  })

  if (isApproved) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-6">
        <div className="flex items-center gap-3">
          <StatusLightSoftBadge token={ONBOARDING_STATUS_TOKEN.ORANGE} label="Naranja" />
          <p className="text-base font-semibold text-ink">
            {actedHotelName || 'El hotel'} ya es cliente activo
          </p>
        </div>
        <p className="text-sm text-ink-3">
          La conversión Rosa → Naranja quedó aprobada: el hotel puede generar requisiciones y el BD
          queda como su referente comercial.
        </p>
        <div className="flex gap-4">
          <Link to="/clientes-activos" className="text-sm font-semibold text-o-700 hover:underline">
            Ver en Clientes Activos
          </Link>
          <Link to="/conversion" className="text-sm font-semibold text-o-700 hover:underline">
            Volver a Conversión
          </Link>
        </div>
      </div>
    )
  }

  if (isReturned) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-6">
        <div className="flex items-center gap-3">
          <StatusLightSoftBadge token={ONBOARDING_STATUS_TOKEN.BROWN} label="Café" />
          <p className="text-base font-semibold text-ink">
            {actedHotelName || 'El prospecto'} volvió a renegociación
          </p>
        </div>
        <p className="text-sm text-ink-3">
          El ciclo sigue vivo en Café: se retoma desde el Pipeline cuando el hotel se desbloquee.
        </p>
        <Link to="/conversion" className="text-sm font-semibold text-o-700 hover:underline">
          Volver a Conversión
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
          <p className="text-sm text-ink-2">
            Este hotel <span className="font-semibold">ya es cliente activo</span>: su conversión ya
            se aprobó.
          </p>
        ) : state ? (
          <p className="text-sm text-ink-2">
            Este prospecto está en{' '}
            <span className="font-semibold">{ONBOARDING_STATUS_LABEL[state]}</span> — la conversión
            sale de Rosa{IS_DEV_UI ? ' (RR-V-02)' : ''}.
          </p>
        ) : (
          <p className="text-sm text-red">No se pudo cargar la conversión. Reintenta.</p>
        )}
        <Link to="/conversion" className="text-sm font-semibold text-o-700 hover:underline">
          Volver a Conversión
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
            Conversión a cliente activo
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
        <SectionCard title="Requisitos para habilitar la conversión">
          {readiness.requirements.length === 0 ? (
            <p className="py-2 text-sm text-ink-3">
              {readiness.blockedReason ?? 'Sin requisitos pendientes.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {readiness.requirements.map((requirement) => (
                <RequirementRow
                  key={requirement.id}
                  requirement={requirement}
                  isActing={isCreatingUser}
                  onAct={() => {
                    if (!readiness.hotelUserDraft) return
                    void createHotelUser({
                      prospectId,
                      hotelId: readiness.hotelId,
                      email: readiness.hotelUserDraft.email,
                      fullName: readiness.hotelUserDraft.fullName,
                    })
                  }}
                />
              ))}
            </ul>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <Button
              disabled={isBusy}
              onClick={() => {
                setIsReturnOpen((open) => !open)
              }}
            >
              Devolver a Café
            </Button>

            <Button
              variant="primary"
              disabled={!readiness.canApprove || isBusy}
              title={readiness.blockedReason ?? undefined}
              onClick={() => {
                setActedHotelName(readiness.hotelName)
                void approveConversion(prospectId)
              }}
            >
              {isApproving ? 'Aprobando…' : 'Aprobar conversión'}
            </Button>
          </div>

          {isReturnOpen && (
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3 rounded-md bg-surface-2 p-3">
              <label htmlFor="returnReason" className="text-sm text-ink-2">
                Motivo del regreso (obligatorio):
              </label>
              <span className="w-64">
                <Select
                  {...(returnReason ? { value: returnReason } : {})}
                  onValueChange={setReturnReason}
                >
                  <SelectTrigger id="returnReason" className="w-full">
                    <SelectValue placeholder="Elige un motivo…" />
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
                }}
              >
                {isReturning ? 'Devolviendo…' : 'Confirmar regreso'}
              </Button>
            </div>
          )}

          {readiness.blockedReason !== null && (
            <p className="mt-3 text-right text-sm text-ink-3">{readiness.blockedReason}</p>
          )}
        </SectionCard>

        <SectionCard title="Qué pasa al aprobar">
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
    </div>
  )
}
