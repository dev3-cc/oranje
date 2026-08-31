import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { useCloseProspectMutation, useGetStatusChangeReasonsQuery } from '../api/onboardingApi'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { apiErrorMessage } from '@/shared/lib/apiError'

/**
 * Archivar el ciclo comercial. NO es lo mismo que marcar Rojo o Negro (esos
 * son reactivables, RR-V-07): cerrar es definitivo y libera al hotel para que
 * alguien abra un ciclo nuevo. El motivo es obligatorio — es lo único que
 * queda para explicar el cierre.
 */
export function ArchiveCycleDialog({
  prospectId,
  hotelName,
  isOpen,
  onClose,
}: {
  prospectId: string
  hotelName: string
  isOpen: boolean
  onClose: () => void
}): ReactNode {
  const navigate = useNavigate()
  /** El catálogo es el mismo del Semáforo Onboarding que usan las transiciones. */
  const { data: reasons = [] } = useGetStatusChangeReasonsQuery('BLACK', { skip: !isOpen })
  const [closeProspect, { isLoading, isError, error }] = useCloseProspectMutation()

  const [reasonCode, setReasonCode] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setReasonCode('')
    setNote('')
  }, [isOpen])

  async function submit(): Promise<void> {
    if (reasonCode === '' || isLoading) return
    try {
      await closeProspect({
        prospectId,
        reasonCode,
        ...(note.trim() !== '' ? { note: note.trim() } : {}),
      }).unwrap()
      onClose()
      /** El ciclo ya no existe como abierto: de vuelta al tablero. */
      void navigate('/pipeline')
    } catch {
      return
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Archivar el ciclo"
      description={`El ciclo de ${hotelName} se cierra definitivamente y el hotel queda libre para un ciclo nuevo.`}
    >
      <div className="flex flex-col gap-4">
        {isError && (
          <p role="alert" className="text-sm text-red">
            {apiErrorMessage(error, {
              byCode: {
                PROSPECT_IS_CLIENT:
                  'Un hotel en Naranja es cliente activo: primero pásalo a Negro y luego archiva.',
                PROSPECT_CLOSED: 'Este ciclo ya estaba cerrado.',
                REASON_NOT_FOUND: 'Ese motivo ya no está disponible: elige otro de la lista.',
              },
              fallback: 'No se pudo archivar el ciclo. Inténtalo de nuevo.',
            })}
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-2">Motivo del cierre</span>
          <Select {...(reasonCode ? { value: reasonCode } : {})} onValueChange={setReasonCode}>
            <SelectTrigger aria-label="Motivo del cierre" className="w-full">
              <SelectValue placeholder="Elige el motivo…" />
            </SelectTrigger>
            <SelectContent>
              {reasons.map((reason) => (
                <SelectItem key={reason.id} value={reason.id}>
                  {reason.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-2">Nota (opcional)</span>
          <Textarea
            value={note}
            onChange={(event) => {
              setNote(event.target.value)
            }}
            rows={3}
            placeholder="Contexto que le sirva a quien abra el siguiente ciclo…"
            aria-label="Nota del cierre"
          />
        </label>

        <p className="rounded-md bg-surface-2 p-3 text-xs text-ink-3">
          Archivar no es marcar Rojo o Negro: esos estados se pueden reactivar. Esto cierra el ciclo
          para siempre.
        </p>

        <div className="flex justify-end gap-3 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={reasonCode === '' || isLoading}
            onClick={() => {
              void submit()
            }}
          >
            {isLoading ? 'Archivando…' : 'Archivar ciclo'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
