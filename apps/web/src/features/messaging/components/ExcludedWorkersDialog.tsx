import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { useGetWorkersSyncStatusQuery, type ExcludedWorker } from '../api/messagingWorkersSyncApi'

import { SYNC_WORKERS_PERMISSION } from './SyncWorkersButton'

import { Modal } from '@/shared/components/Modal'
import { useCan } from '@/shared/hooks/useCan'

/**
 * Los colaboradores que no se pueden sincronizar (sin teléfono o con uno
 * inválido). Vienen en el mismo conteo del aviso: RTK lo comparte, no es otra
 * llamada.
 */
export function useExcludedWorkers(): ExcludedWorker[] {
  const can = useCan()
  const { data } = useGetWorkersSyncStatusQuery(undefined, {
    skip: !can(SYNC_WORKERS_PERMISSION),
  })
  return data?.configured === true ? data.excluded : []
}

/**
 * «N colaboradores sin teléfono válido · Ver» en Campañas: siempre a la vista
 * mientras haya alguno, para que Reclutamiento los corrija desde el expediente
 * (Hugo, 2026-10-23).
 */
export function ExcludedWorkersLink(): ReactNode {
  const excluded = useExcludedWorkers()
  const [open, setOpen] = useState(false)
  if (excluded.length === 0) return null

  return (
    <p className="text-sm text-ink-3">
      {excluded.length === 1 ? (
        <Trans>1 colaborador sin teléfono válido</Trans>
      ) : (
        <Trans>{excluded.length} colaboradores sin teléfono válido</Trans>
      )}{' '}
      ·{' '}
      <button
        type="button"
        className="cursor-pointer font-semibold text-o-700 hover:underline"
        onClick={() => {
          setOpen(true)
        }}
      >
        <Trans>Ver</Trans>
      </button>
      {open && (
        <ExcludedWorkersDialog
          excluded={excluded}
          onClose={() => {
            setOpen(false)
          }}
        />
      )}
    </p>
  )
}

export function ExcludedWorkersDialog({
  excluded,
  onClose,
}: {
  excluded: ExcludedWorker[]
  onClose: () => void
}): ReactNode {
  const { i18n } = useLingui()

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={i18n._(msg`Colaboradores sin teléfono válido`)}
      description={i18n._(
        msg`No se sincronizan con Mensajería, así que ninguna campaña les llega. Corrige el teléfono en su expediente.`,
      )}
      className="max-w-2xl"
    >
      {excluded.length === 0 ? (
        <p className="text-sm text-ink-3">
          <Trans>Todos los colaboradores tienen un teléfono válido.</Trans>
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {excluded.map((worker) => (
            <li key={worker.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{worker.fullName}</p>
                <p className="text-xs text-ink-3">
                  {worker.reason === 'NO_PHONE' ? (
                    <Trans>Sin teléfono</Trans>
                  ) : (
                    <Trans>Teléfono inválido: {worker.phone}</Trans>
                  )}
                </p>
              </div>
              <Link
                to={`/collaborator-pool/${worker.id}`}
                onClick={onClose}
                className="text-sm font-semibold text-o-700 hover:underline"
              >
                <Trans>Abrir expediente</Trans>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
