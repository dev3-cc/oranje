import {
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusLightBadge,
} from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import {
  useChangeProspectStatusMutation,
  useGetAllowedTransitionsQuery,
  useGetStatusChangeReasonsQuery,
} from '../api/onboardingApi'

import { SemaforoHelpButton } from './SemaforoHelpDialog'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
  type OnboardingStatus,
} from '@/shared/constants/onboardingStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'

export interface ChangeStatusDialogProps {
  isOpen: boolean
  onClose: () => void
  prospectId: string
  hotelName: string
  currentStatus: OnboardingStatus
  presetStatus?: OnboardingStatus
}

const ROLE_SHORT: Record<string, string> = {
  'ROL-V-01': 'el BD',
  'ROL-V-02': 'el BDC',
  'ROL-SYS-01': 'el Sistema',
  'ROL-ADM-01': 'el Administrador',
}

function transitionErrorMessage(error: unknown): string {
  const data = (
    error as
      | {
          data?: {
            error?: {
              code?: string
              message?: string
              details?: Array<{ field?: string; value?: unknown }>
            }
          }
        }
      | undefined
  )?.data
  const code = data?.error?.code
  const details = data?.error?.details ?? []

  if (code === 'PROPOSAL_REQUIRED') {
    return 'Verde no se abandona sin enviar la Propuesta Personalizada: abre la propuesta, envíala y vuelve a intentar.'
  }
  if (code === 'HOTEL_USER_REQUIRED') {
    return 'Para convertir a Naranja primero debe existir el Usuario del Hotel: créalo desde Conversión.'
  }
  if (code === 'TRANSITION_FORBIDDEN') {
    const roles = details
      .map((item) => ROLE_SHORT[String(item.value)] ?? String(item.value))
      .join(' o ')
    return `Ese paso existe, pero lo ejecuta ${roles || 'otro rol'}: pídeselo — tu rol no lo tiene asignado.`
  }
  if (code === 'TRANSITION_NOT_ALLOWED') {
    const targets = details
      .map((item) => ONBOARDING_STATUS_LABEL[item.value as OnboardingStatus] ?? String(item.value))
      .join(', ')
    return targets
      ? `Desde aquí el semáforo solo permite ir a: ${targets}.`
      : 'Ese paso no existe en el Semáforo: elige otro estado.'
  }
  if (code === 'REASON_REQUIRED') return 'Esta transición exige un motivo: elígelo de la lista.'
  if (data?.error?.message) return data.error.message
  return 'No se pudo cambiar el estado. Revisa el motivo e inténtalo de nuevo.'
}

export function ChangeStatusDialog({
  isOpen,
  onClose,
  prospectId,
  hotelName,
  currentStatus,
  presetStatus,
}: ChangeStatusDialogProps): ReactNode {
  const [selectedStatus, setSelectedStatus] = useState<OnboardingStatus | null>(null)
  const [reasonId, setReasonId] = useState('')

  const { data: allowed, isLoading: areTransitionsLoading } = useGetAllowedTransitionsQuery(
    prospectId,
    { skip: !isOpen },
  )
  const [changeStatus, { isLoading: isSaving, error: saveError }] =
    useChangeProspectStatusMutation()

  const selectedTransition = allowed?.transitions.find((t) => t.toStatus === selectedStatus) ?? null
  const isReasonRequired = selectedTransition?.requiresReason ?? false

  const { data: reasons = [], isLoading: areReasonsLoading } = useGetStatusChangeReasonsQuery(
    selectedStatus as OnboardingStatus,
    { skip: !selectedStatus || !isReasonRequired },
  )

  useEffect(() => {
    if (isOpen) return
    setSelectedStatus(null)
    setReasonId('')
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !presetStatus || selectedStatus !== null || !allowed) return
    if (allowed.transitions.some((transition) => transition.toStatus === presetStatus)) {
      setSelectedStatus(presetStatus)
    }
  }, [isOpen, presetStatus, selectedStatus, allowed])

  const canSubmit = selectedStatus !== null && (!isReasonRequired || reasonId !== '') && !isSaving

  async function handleConfirm(): Promise<void> {
    if (!selectedStatus) return

    try {
      await changeStatus({
        prospectId,
        toStatus: selectedStatus,
        ...(isReasonRequired ? { reasonId } : {}),
      }).unwrap()
      onClose()
    } catch {
      return
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cambiar estado"
      description={`${hotelName} · desde ${ONBOARDING_STATUS_LABEL[currentStatus]}. Solo ves los pasos que tu rol puede dar.`}
      footer={
        <>
          <Button onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              void handleConfirm()
            }}
            disabled={!canSubmit}
          >
            {isSaving ? 'Guardando…' : 'Confirmar cambio'}
          </Button>
        </>
      }
    >
      {areTransitionsLoading && (
        <p className="text-sm text-ink-3">Cargando los pasos disponibles…</p>
      )}

      {!areTransitionsLoading && allowed?.transitions.length === 0 && (
        <p className="rounded-md bg-surface-2 p-4 text-sm text-ink-2">
          Desde este estado tu rol no puede mover el prospecto a otro.
        </p>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Nuevo estado</legend>

        {allowed?.transitions.map((transition) => {
          const isSelected = transition.toStatus === selectedStatus

          return (
            <label
              key={transition.toStatus}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-md p-4 transition-colors',
                isSelected ? 'border-2 border-o-500' : 'border border-line hover:bg-surface-2',
              )}
            >
              <input
                type="radio"
                name="toStatus"
                value={transition.toStatus}
                checked={isSelected}
                onChange={() => {
                  setSelectedStatus(transition.toStatus)
                  setReasonId('')
                }}
                className="sr-only"
              />

              <span
                aria-hidden
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border',
                  isSelected ? 'border-o-500' : 'border-line',
                )}
              >
                {isSelected && <span className="size-2.5 rounded-full bg-o-500" />}
              </span>

              <StatusLightBadge
                token={ONBOARDING_STATUS_TOKEN[transition.toStatus]}
                label={ONBOARDING_STATUS_LABEL[transition.toStatus]}
                className="shrink-0"
              />

              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{transition.title}</span>
                <span className="block text-sm text-ink-3">{transition.description}</span>
              </span>
            </label>
          )
        })}
      </fieldset>

      {allowed?.restrictionNote && (
        <p className="rounded-md bg-o-50 p-4 text-sm leading-relaxed text-ink-2">
          {allowed.restrictionNote}
        </p>
      )}

      {selectedTransition && (
        <div className="flex flex-col gap-2">
          <label htmlFor="status-change-reason" className="text-sm font-semibold text-ink">
            Motivo{' '}
            {isReasonRequired ? (
              <span className="font-normal text-red">obligatorio</span>
            ) : (
              <span className="font-normal text-ink-3">opcional</span>
            )}
          </label>

          <Select
            key={selectedStatus ?? 'none'}
            {...(reasonId ? { value: reasonId } : {})}
            disabled={areReasonsLoading}
            onValueChange={setReasonId}
          >
            <SelectTrigger id="status-change-reason" className="w-full">
              <SelectValue
                placeholder={areReasonsLoading ? 'Cargando motivos…' : 'Elige el motivo…'}
              />
            </SelectTrigger>
            <SelectContent>
              {reasons.map((reason) => (
                <SelectItem key={reason.id} value={reason.id}>
                  {reason.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isReasonRequired && (
            <p className="text-xs text-ink-3">
              {IS_DEV_UI
                ? 'catalogs.status_change_reason — requires_reason está activo en esta transición'
                : 'El motivo queda en el historial del prospecto.'}
            </p>
          )}
        </div>
      )}

      {saveError !== undefined && (
        <p role="alert" className="rounded-md bg-red/10 p-4 text-sm text-red">
          {transitionErrorMessage(saveError)}
        </p>
      )}

      {}
      <div className="flex items-start gap-2 rounded-md bg-surface-2 p-3">
        <p className="text-xs leading-relaxed text-ink-3">
          ¿Necesitas regresarlo? El semáforo no retrocede: se sale por una rama y se reactiva hacia
          Azul claro. Desde <span className="font-semibold">Rojo</span> reactiva el BD; desde{' '}
          <span className="font-semibold">Café</span> y <span className="font-semibold">Negro</span>
          , solo el BDC.
        </p>
        <SemaforoHelpButton className="shrink-0" />
      </div>
    </Modal>
  )
}
