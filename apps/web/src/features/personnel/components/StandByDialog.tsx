import { Alert, AlertDescription } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import { useSendToStandByMutation } from '../api/personnelApi'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { apiErrorMessage } from '@/shared/lib/apiError'

export function StandByDialog({
  workerId,
  workerName,
  isOpen,
  onClose,
}: {
  workerId: string
  workerName: string
  isOpen: boolean
  onClose: () => void
}): ReactNode {
  const [send, { isLoading, isError, error: sendError }] = useSendToStandByMutation()
  const [note, setNote] = useState('')

  const canSubmit = note.trim() !== '' && !isLoading

  async function submit(): Promise<void> {
    if (!canSubmit) return
    try {
      await send({ workerId, note: note.trim() }).unwrap()
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
      title={`Mandar a Stand-by a ${workerName}`}
      description="Pasa a Rosa: pausado, sin turnos nuevos, hasta que el hotel lo reactive."
      footer={
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={() => {
              void submit()
            }}
          >
            {isLoading ? 'Enviando…' : 'Mandar a Stand-by'}
          </Button>
        </div>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-3">Motivo (obligatorio)</span>
        <textarea
          value={note}
          onChange={(event) => {
            setNote(event.target.value)
          }}
          rows={3}
          placeholder="Bajó el ritmo de ocupación esta semana…"
          className="w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none"
        />
      </label>
      {isError && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>
            {apiErrorMessage(sendError, { fallback: 'No se pudo mandar a Stand-by.' })}
          </AlertDescription>
        </Alert>
      )}
    </Modal>
  )
}
