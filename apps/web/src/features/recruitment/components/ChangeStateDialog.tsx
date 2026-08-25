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

/**
 * Cambiar el estado del semáforo: solo ofrece lo que `GET /transitions` dice
 * que MI rol puede disparar — el resto de las aristas son del sistema, del
 * hotel o del Inspector, y aquí ni se pintan. Una lista vacía se dice.
 */
export function ChangeStateDialog({
  workerId,
  currentLabel,
  isOpen,
  onClose,
}: {
  workerId: string
  currentLabel: string
  isOpen: boolean
  onClose: () => void
}): ReactNode {
  const { data: transitions = [], isLoading } = useGetWorkerTransitionsQuery(workerId, {
    skip: !isOpen,
  })
  const [change, { isLoading: isSaving, isError, error: saveError }] =
    useChangeWorkerStateMutation()

  const [toState, setToState] = useState('')
  const [note, setNote] = useState('')

  const selected = transitions.find((transition) => transition.toState === toState)
  const canSubmit = selected !== undefined && (!selected.requiresReason || note.trim() !== '')

  async function submit(): Promise<void> {
    if (!canSubmit || !selected) return
    try {
      await change({
        workerId,
        toState: selected.toState,
        ...(note.trim() !== '' ? { note: note.trim() } : {}),
      }).unwrap()
      setToState('')
      setNote('')
      onClose()
    } catch {
      /* el error queda en `isError` */
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cambiar estado"
      description={`Hoy: ${currentLabel}. El semáforo solo camina por sus transiciones sembradas.`}
      footer={
        <div className="flex items-center justify-end gap-3">
          {transitions.length > 0 && selected === undefined && (
            <span className="mr-auto text-xs text-ink-3">Elige el estado destino</span>
          )}
          {selected?.requiresReason && note.trim() === '' && (
            <span className="mr-auto text-xs text-ink-3">Esta transición exige un motivo</span>
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
            {isSaving ? 'Aplicando…' : 'Aplicar transición'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {isLoading && <p className="text-sm text-ink-3">Consultando transiciones…</p>}

        {!isLoading && transitions.length === 0 && (
          <p className="rounded-md bg-surface-2 px-4 py-3 text-sm text-ink-2">
            Desde este estado tu rol no dispara ninguna transición: las que salen de aquí son del
            sistema, del hotel o del Inspector.
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

        {transitions.length > 0 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-3">
              Nota{selected?.requiresReason ? '' : ' (opcional)'}
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
          <p role="alert" className="text-sm text-red">
            {apiErrorMessage(saveError, { fallback: 'No se pudo aplicar la transición.' })}
          </p>
        )}
      </div>
    </Modal>
  )
}
