import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { MaterialIcon, cn, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import {
  useGetWorkersSyncStatusQuery,
  useSyncWorkersToMessagingMutation,
} from '../api/messagingWorkersSyncApi'

import { ExcludedWorkersDialog, useExcludedWorkers } from './ExcludedWorkersDialog'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'

/** Quien ve el Pool completo: los demás no ven los teléfonos. */
export const SYNC_WORKERS_PERMISSION = 'recruitment:search_candidates'

/**
 * «Sincronizar colaboradores» (idea del equipo, Hugo, 2026-10-23): registra a
 * los colaboradores como contactos de la plataforma de mensajería, con
 * etiquetas «Oranje», «Hotel: …» y «Estado: …» para elegirlos en una campaña.
 * Los de la lista negra también van, pero inactivos: no les llega nada.
 * Resaltado cuando faltan colaboradores por sincronizar. Pide confirmación:
 * escribe en la plataforma de producción.
 */
export function SyncWorkersButton({ highlight = false }: { highlight?: boolean }): ReactNode {
  const { i18n } = useLingui()
  const can = useCan()
  const [sync, { isLoading }] = useSyncWorkersToMessagingMutation()
  const [confirming, setConfirming] = useState(false)
  const [showExcluded, setShowExcluded] = useState(false)
  const excluded = useExcludedWorkers()
  const allowed = can(SYNC_WORKERS_PERMISSION)
  /* El mismo conteo del aviso; RTK lo comparte, no es otra llamada. */
  const { data: status } = useGetWorkersSyncStatusQuery(undefined, { skip: !allowed })
  const close = (): void => {
    setConfirming(false)
  }

  if (!allowed) return null

  const run = async (): Promise<void> => {
    try {
      const result = await sync().unwrap()
      close()
      toast.success(
        i18n._(
          msg`${result.sent} enviados a Mensajería: ${result.created} nuevos y ${result.updated} actualizados.`,
        ),
      )
      if (result.deactivated + result.reactivated > 0) {
        toast.info(
          i18n._(
            msg`Lista negra: ${result.deactivated} dejan de recibir y ${result.reactivated} vuelven a recibir.`,
          ),
        )
      }
      const skipped = result.withoutPhone + result.invalidPhone + result.rejected
      if (skipped > 0) {
        toast.warning(
          i18n._(
            msg`No se enviaron ${skipped}: ${result.withoutPhone} sin teléfono y ${result.invalidPhone + result.rejected} con teléfono inválido.`,
          ),
          {
            action: {
              label: i18n._(msg`Ver`),
              onClick: () => {
                setShowExcluded(true)
              },
            },
          },
        )
      }
    } catch (error) {
      toast.error(
        apiErrorMessage(error, {
          fallback: i18n._(msg`No se pudieron sincronizar los colaboradores.`),
        }),
      )
    }
  }

  return (
    <>
      <Button
        variant={highlight ? 'primary' : 'secondary'}
        className="h-10"
        disabled={isLoading}
        onClick={() => {
          setConfirming(true)
        }}
      >
        <MaterialIcon name="sync" className={cn('text-lg', isLoading && 'animate-spin')} />
        {isLoading ? <Trans>Sincronizando…</Trans> : <Trans>Sincronizar colaboradores</Trans>}
      </Button>

      <Modal
        isOpen={confirming}
        onClose={close}
        title={i18n._(msg`¿Sincronizar colaboradores con Mensajería?`)}
        description={
          status?.configured === true
            ? i18n._(
                msg`Se registran o actualizan ${status.workers} colaboradores como contactos en la plataforma, con sus etiquetas de hotel y estado. Los de la lista negra quedan inactivos.`,
              )
            : i18n._(
                msg`Se registran o actualizan los colaboradores como contactos en la plataforma, con sus etiquetas de hotel y estado. Los de la lista negra quedan inactivos.`,
              )
        }
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              <Trans>Volver</Trans>
            </Button>
            <Button variant="primary" disabled={isLoading} onClick={() => void run()}>
              {isLoading ? <Trans>Sincronizando…</Trans> : <Trans>Sincronizar</Trans>}
            </Button>
          </>
        }
      >
        {null}
      </Modal>

      {showExcluded && (
        <ExcludedWorkersDialog
          excluded={excluded}
          onClose={() => {
            setShowExcluded(false)
          }}
        />
      )}
    </>
  )
}
