import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'

import { useGetRequisitionJournalQuery } from '../api/requisitionJournalApi'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDayMonthTime } from '@/shared/lib/formatters'

/**
 * Ícono por evento REAL de `journal.journal` (verificado contra la base:
 * `demand.requisition` solo produce estos cinco). Uno que no se reconozca
 * —el journal es lista abierta— cae al genérico; nunca se inventa una
 * etiqueta para él, se muestra el propio `eventType`.
 */
const EVENT_ICON: Record<string, string> = {
  REQUISITION_CREATED: 'add_circle',
  REQUISITION_AUTHORIZED: 'verified',
  REQUISITION_DELETED: 'delete',
  RECRUITER_JOINED: 'person_add',
  RECRUITER_LEFT: 'person_remove',
}

/** La etiqueta de cada evento; se traduce al pintar con `i18n._()` (D-36). */
const EVENT_LABEL: Record<string, MessageDescriptor> = {
  REQUISITION_CREATED: msg`Requisición creada`,
  REQUISITION_AUTHORIZED: msg`Requisición autorizada`,
  REQUISITION_DELETED: msg`Requisición eliminada`,
  RECRUITER_JOINED: msg`Reclutadora se unió`,
  RECRUITER_LEFT: msg`Reclutadora salió`,
}

/**
 * Bitácora de una requisición: quién hizo qué y cuándo, tal cual vive en
 * `journal.journal` (append-only, RR-16). Sin permiso propio en el front: si
 * el detalle cargó, el back ya autorizó ver esto también.
 */
export function RequisitionJournalDialog({
  requisitionId,
  onClose,
}: {
  requisitionId: string
  onClose: () => void
}): ReactNode {
  const { t, i18n } = useLingui()
  const { data: entries, isLoading, isError } = useGetRequisitionJournalQuery(requisitionId)

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t`Bitácora de la requisición`}
      {...(IS_DEV_UI ? { description: 'journal.journal · entity_type = demand.requisition' } : {})}
      className="max-w-lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          <Trans>Cerrar</Trans>
        </Button>
      }
    >
      {isLoading && (
        <p className="text-sm text-ink-3">
          <Trans>Cargando bitácora…</Trans>
        </p>
      )}

      {/*
        Mensaje fijo, no lo que traiga el error: el 404 real y el del mock no
        redactan igual (mismo criterio que la página de detalle con la
        requisición que no existe).
      */}
      {isError && (
        <p role="alert" className="text-sm text-red">
          <Trans>No se pudo cargar la bitácora. Inténtalo de nuevo.</Trans>
        </p>
      )}

      {!isLoading && !isError && entries && entries.length === 0 && (
        <p className="text-sm text-ink-3">
          <Trans>Sin eventos registrados todavía.</Trans>
        </p>
      )}

      {!isLoading && !isError && entries && entries.length > 0 && (
        <ol className="flex flex-col">
          {entries.map((entry, index) => {
            const label = EVENT_LABEL[entry.eventType]
            return (
              <li key={entry.id} className={index === 0 ? '' : 'mt-4 border-t border-line pt-4'}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-o-50 text-o-700">
                    <MaterialIcon
                      name={EVENT_ICON[entry.eventType] ?? 'history'}
                      className="text-lg"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">
                      {label ? i18n._(label) : entry.eventType}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-3">
                      {entry.actorName ?? t`Sistema`}
                      {entry.actorRole ? ` · ${entry.actorRole}` : ''} ·{' '}
                      {formatDayMonthTime(entry.occurredAt)}
                    </p>
                    {IS_DEV_UI && entry.payload != null && (
                      <pre className="mt-2 overflow-x-auto rounded-md bg-surface-2 p-2 text-xs text-ink-3">
                        {JSON.stringify(entry.payload, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Modal>
  )
}
