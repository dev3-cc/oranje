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
} from '@/shared/constants/onboardingStatus'

/**
 * Conversión de un prospecto a cliente activo.
 *
 * Los requisitos, el permiso y lo que ocurre al aprobar los decide el BACKEND y
 * esta pantalla los pinta. No deduce si se puede aprobar contando palomitas:
 * usa `canApprove`, porque las reglas de negocio no pueden vivir en dos sitios.
 */
export function ConversionPage(): ReactNode {
  const { prospectId = '' } = useParams()

  const {
    data: readiness,
    isLoading,
    isError,
  } = useGetConversionReadinessQuery(prospectId, { skip: prospectId === '' })

  const [createHotelUser, { isLoading: isCreatingUser }] = useCreateHotelUserMutation()
  const [approveConversion, { isLoading: isApproving }] = useApproveConversionMutation()
  const [returnToRenegotiation, { isLoading: isReturning }] = useReturnToRenegotiationMutation()

  /** Rosa → Café exige motivo: el botón abre la elección en vez de ejecutar. */
  const [isReturnOpen, setIsReturnOpen] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const { data: returnReasons = [] } = useGetStatusChangeReasonsQuery('BROWN', {
    skip: !isReturnOpen,
  })

  if (isLoading) return <DetailSkeleton />

  if (isError || !readiness) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-6">
        <p className="text-sm text-red">Este prospecto no está esperando conversión.</p>
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
              <select
                id="returnReason"
                value={returnReason}
                onChange={(event) => {
                  setReturnReason(event.target.value)
                }}
                className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
              >
                <option value="">Elige un motivo…</option>
                {returnReasons.map((reason) => (
                  <option key={reason.id} value={reason.id}>
                    {reason.label}
                  </option>
                ))}
              </select>
              <Button
                disabled={returnReason === '' || isBusy}
                onClick={() => {
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
