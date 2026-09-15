import { Trans, useLingui } from '@lingui/react/macro'
import { toast } from '@oranje/ui'
import { type ReactNode } from 'react'

import { useDeleteWorkerMutation } from '../api/poolApi'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { apiErrorMessage } from '@/shared/lib/apiError'

/**
 * Eliminar del Pool (Hugo, 2026-09-15): nunca borra la fila — queda fuera de
 * toda lista — y de paso se borra su correo corporativo en cPanel si tenía.
 * Si sigue trabajando, TAMBIÉN se libera cada asignación activa suya (Hugo
 * confirmó que sí se puede eliminar en ese caso): es la misma liberación que
 * soltarlo a mano de un slot, así que la cobertura se recalcula igual.
 */
export function DeleteWorkerDialog({
  workerId,
  fullName,
  isOpen,
  onClose,
  onDeleted,
}: {
  workerId: string
  fullName: string
  isOpen: boolean
  onClose: () => void
  onDeleted?: () => void
}): ReactNode {
  const { t } = useLingui()
  const [deleteWorker, { isLoading, isError, error }] = useDeleteWorkerMutation()

  async function submit(): Promise<void> {
    if (isLoading) return
    try {
      await deleteWorker(workerId).unwrap()
      toast.success(t`${fullName} se eliminó del Pool`)
      onClose()
      onDeleted?.()
    } catch {
      return
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t`Eliminar colaborador`}
      description={t`${fullName} deja de aparecer en el Pool y en toda búsqueda. Si tiene correo corporativo, también se elimina su buzón.`}
    >
      <div className="flex flex-col gap-4">
        {isError && (
          <p role="alert" className="text-sm text-red">
            {apiErrorMessage(error, {
              byCode: {
                WORKER_HAS_ACTIVE_ASSIGNMENT: t`Tiene una asignación activa en un hotel: primero hay que terminarla o reasignarla.`,
              },
              fallback: t`No se pudo eliminar al colaborador. Inténtalo de nuevo.`,
            })}
          </p>
        )}

        <p className="rounded-md bg-surface-2 p-3 text-xs text-ink-3">
          <Trans>
            Esto no se deshace desde aquí. Si sigue trabajando en algún hotel, su asignación se
            libera al eliminarlo. El expediente y su historial se conservan por dentro, pero nadie
            vuelve a verlo en el Pool.
          </Trans>
        </p>

        <div className="flex justify-end gap-3 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose}>
            <Trans>Cancelar</Trans>
          </Button>
          <Button
            variant="primary"
            disabled={isLoading}
            onClick={() => {
              void submit()
            }}
          >
            {isLoading ? t`Eliminando…` : t`Sí, eliminar`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
