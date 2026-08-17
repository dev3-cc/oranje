import { cn, SemaforoBadge } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import {
  useChangeProspectStatusMutation,
  useGetAllowedTransitionsQuery,
  useGetStatusChangeReasonsQuery,
} from '../api/onboardingApi'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
  type OnboardingStatus,
} from '@/shared/constants/onboardingStatus'

export interface ChangeStatusDialogProps {
  isOpen: boolean
  onClose: () => void
  prospectId: string
  hotelName: string
  currentStatus: OnboardingStatus
}

/**
 * Cambio de estado del semáforo.
 *
 * Las transiciones NO se calculan aquí: se piden al backend, que ya las filtró
 * por el rol de la sesión. Si una no llega, no se puede ejecutar — y el aviso
 * de por qué se ocultó también lo redacta el backend.
 *
 * El motivo se exige cuando la transición trae `requiresReason`, que es el
 * `requires_reason` del catálogo. El botón queda bloqueado hasta que hay uno.
 */
export function ChangeStatusDialog({
  isOpen,
  onClose,
  prospectId,
  hotelName,
  currentStatus,
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

  // Al cerrar se descarta la selección: reabrir no debe heredar el intento previo.
  useEffect(() => {
    if (isOpen) return
    setSelectedStatus(null)
    setReasonId('')
  }, [isOpen])

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
      // El error queda en `saveError` y se pinta abajo; el modal no se cierra.
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cambiar estado"
      description={`${hotelName} · desde ${ONBOARDING_STATUS_LABEL[currentStatus]}. Solo se muestran las transiciones que tu rol puede ejecutar.`}
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
      {areTransitionsLoading && <p className="text-sm text-ink-3">Cargando transiciones…</p>}

      {!areTransitionsLoading && allowed?.transitions.length === 0 && (
        <p className="rounded-md bg-surface-2 p-4 text-sm text-ink-2">
          No hay transiciones disponibles para tu rol desde este estado.
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

              <SemaforoBadge
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

          <select
            id="status-change-reason"
            value={reasonId}
            disabled={areReasonsLoading}
            onChange={(event) => {
              setReasonId(event.target.value)
            }}
            className={cn(
              'w-full rounded-md border border-line bg-surface px-4 py-3 text-sm',
              'focus:border-o-500 focus:outline-none',
              reasonId === '' ? 'text-ink-4' : 'text-ink',
            )}
          >
            <option value="">
              {areReasonsLoading ? 'Cargando catálogo…' : 'Selecciona un motivo del catálogo...'}
            </option>
            {reasons.map((reason) => (
              <option key={reason.id} value={reason.id} className="text-ink">
                {reason.label}
              </option>
            ))}
          </select>

          {isReasonRequired && (
            <p className="text-xs text-ink-3">
              catalogs.status_change_reason — requires_reason está activo en esta transición
            </p>
          )}
        </div>
      )}

      {saveError !== undefined && (
        <p className="rounded-md bg-red/10 p-4 text-sm text-red">
          No se pudo cambiar el estado. Revisa el motivo e inténtalo de nuevo.
        </p>
      )}
    </Modal>
  )
}
