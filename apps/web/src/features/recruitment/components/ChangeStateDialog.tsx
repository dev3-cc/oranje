import { Alert, AlertDescription, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import { useChangeWorkerStateMutation, useGetWorkerTransitionsQuery } from '../api/workerDetailApi'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  workerStatusChipLabel,
  WORKER_STATUS_TOKEN,
  type WorkerStatus,
} from '@/shared/constants/workerStatus'
import { apiErrorMessage } from '@/shared/lib/apiError'

export function ChangeStateDialog({
  workerId,
  currentLabel,
  isOpen,
  onClose,
  missingProfileFields = [],
}: {
  workerId: string
  currentLabel: string
  isOpen: boolean
  onClose: () => void
  /** El expediente a medias no deja validar (`PROFILE_INCOMPLETE`) — sin esto
      el rechazo del backend dice «a medias» y no dice de QUÉ, así que aquí se
      apaga la opción de antemano con la lista exacta. */
  missingProfileFields?: string[]
}): ReactNode {
  const { data: transitions = [], isLoading } = useGetWorkerTransitionsQuery(workerId, {
    skip: !isOpen,
  })
  const [change, { isLoading: isSaving, isError, error: saveError }] =
    useChangeWorkerStateMutation()

  const [toState, setToState] = useState('')
  const [note, setNote] = useState('')

  const selected = transitions.find((transition) => transition.toState === toState)
  const isProfileBlocked = selected?.toState === 'STRONG_GREEN' && missingProfileFields.length > 0
  const canSubmit =
    selected !== undefined && !isProfileBlocked && (!selected.requiresReason || note.trim() !== '')

  async function submit(): Promise<void> {
    if (!canSubmit || !selected) return
    try {
      await change({
        workerId,
        toState: selected.toState,
        ...(note.trim() !== '' ? { note: note.trim() } : {}),
      }).unwrap()
      toast.success(`Estado cambiado a ${workerStatusChipLabel(selected.toState as WorkerStatus)}`)
      setToState('')
      setNote('')
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
      description={`Estado actual: ${currentLabel}. Solo puedes elegir los cambios permitidos para tu rol.`}
      footer={
        <div className="flex items-center justify-end gap-3">
          {transitions.length > 0 && selected === undefined && (
            <span className="mr-auto text-xs text-ink-3">Elige el nuevo estado</span>
          )}
          {isProfileBlocked && (
            <span className="mr-auto text-xs text-ink-3">
              Falta completar el expediente para validarlo
            </span>
          )}
          {!isProfileBlocked && selected?.requiresReason && note.trim() === '' && (
            <span className="mr-auto text-xs text-ink-3">Este cambio necesita un motivo</span>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit || isSaving}
            onClick={() => {
              void submit()
            }}
          >
            {isSaving ? 'Cambiando…' : 'Cambiar estado'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {isLoading && <p className="text-sm text-ink-3">Buscando los cambios disponibles…</p>}

        {!isLoading && transitions.length === 0 && (
          <p className="rounded-md bg-surface-2 px-4 py-3 text-sm text-ink-2">
            Desde este estado tu rol no puede hacer ningún cambio: los siguientes los hace el
            sistema, el Hotel o el Inspector.
          </p>
        )}

        {transitions.map((transition) => (
          <label
            key={transition.toState}
            className="flex cursor-pointer items-center gap-3 rounded-md border border-line px-4 py-3 has-checked:border-o-500"
          >
            <input
              type="radio"
              name="toState"
              value={transition.toState}
              checked={toState === transition.toState}
              onChange={() => {
                setToState(transition.toState)
              }}
            />
            <StatusLightSoftBadge
              token={WORKER_STATUS_TOKEN[transition.toState as WorkerStatus] ?? 'st-blanco'}
              label={workerStatusChipLabel(transition.toState as WorkerStatus)}
            />
            {transition.requiresReason && (
              <span className="ml-auto text-xs text-ink-4">motivo obligatorio</span>
            )}
          </label>
        ))}

        {toState === 'STRONG_GREEN' && missingProfileFields.length > 0 && (
          <p className="rounded-md bg-surface-2 px-4 py-3 text-sm text-ink-2">
            No se puede validar todavía: falta {missingProfileFields.join(', ')} en su expediente.
          </p>
        )}

        {transitions.length > 0 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-3">
              Motivo{selected?.requiresReason ? '' : ' (opcional)'}
            </span>
            <textarea
              value={note}
              onChange={(event) => {
                setNote(event.target.value)
              }}
              rows={2}
              className="w-full rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink focus:border-o-500 focus:outline-none"
            />
          </label>
        )}

        {isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {apiErrorMessage(saveError, {
                fallback: 'No se pudo cambiar el estado. Inténtalo de nuevo.',
              })}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Modal>
  )
}
