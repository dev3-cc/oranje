import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { cn, MaterialIcon } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import { useGetAuditsQuery } from '../api/auditsApi'
import type { AuditHeader, AuditType } from '../types/audit.types'

import { EnvironmentAuditDialog } from './EnvironmentAuditDialog'
import { PersonalPresentationAuditDialog } from './PersonalPresentationAuditDialog'

import { EmptyState } from '@/shared/components/EmptyState'
import { LoadError } from '@/shared/components/LoadError'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { formatDayMonthTime } from '@/shared/lib/formatters'

const AUDIT_TYPE_LABEL: Record<AuditType, MessageDescriptor> = {
  PERSONAL_PRESENTATION: msg`Presentación Personal`,
  ENVIRONMENT: msg`Ambiente y Recursos`,
}

function scoreTone(score: string): string {
  const value = Number(score)
  if (value >= 80) return 'border-green/40 bg-green/10 text-green'
  if (value >= 60) return 'border-yellow/50 bg-yellow/15 text-ink-2'
  return 'border-red/40 bg-red/10 text-red'
}

/**
 * El historial del hotel: quién auditó qué, cuándo y con qué calificación.
 * El Manager de Área/General lo ve con `audits:read` sin poder crear; el
 * Supervisor con `audits:update` puede reabrir cualquier fila para
 * corregirla (PATCH sobre la misma auditoría, no una nueva).
 */
export function AuditHistoryList({
  hotelId,
  hotelName,
  canUpdate,
}: {
  hotelId: string
  hotelName: string
  canUpdate: boolean
}): ReactNode {
  const { t, i18n } = useLingui()
  const { data: audits, isLoading, isError, refetch } = useGetAuditsQuery({ hotelId })
  const [editing, setEditing] = useState<AuditHeader | null>(null)

  if (isLoading) return <TableSkeleton rows={4} columns={4} />
  if (isError) {
    return (
      <LoadError
        message={t`No se pudo cargar el historial de auditorías. Inténtalo de nuevo.`}
        onRetry={() => {
          void refetch()
        }}
      />
    )
  }
  if (!audits || audits.length === 0) {
    return (
      <EmptyState
        title={t`Todavía no hay auditorías`}
        text={t`Cuando se guarde la primera de Presentación Personal o de Ambiente y Recursos, aparecerá aquí.`}
      />
    )
  }

  return (
    <>
      <ul className="overflow-hidden rounded-lg border border-line bg-surface">
        {audits.map((audit) => (
          <li
            key={audit.id}
            className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
          >
            {audit.worker ? (
              audit.worker.photoUrl ? (
                <img
                  src={audit.worker.photoUrl}
                  alt=""
                  className="size-9 shrink-0 rounded-full object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-o-500 text-xs font-bold text-ink"
                >
                  {audit.worker.fullName.charAt(0)}
                </span>
              )
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-ink-3">
                <MaterialIcon name="apartment" className="text-lg" aria-hidden />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {audit.worker?.fullName ?? i18n._(AUDIT_TYPE_LABEL[audit.auditType])}
              </p>
              <p className="text-xs text-ink-3">
                {i18n._(AUDIT_TYPE_LABEL[audit.auditType])} · {formatDayMonthTime(audit.createdAt)}{' '}
                · {audit.supervisor.fullName}
              </p>
            </div>
            <span
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold',
                scoreTone(audit.score),
              )}
            >
              {Number(audit.score).toFixed(0)}%
            </span>
            {canUpdate && (
              <button
                type="button"
                onClick={() => {
                  setEditing(audit)
                }}
                className="shrink-0 cursor-pointer rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:bg-surface-2"
              >
                <Trans>Corregir</Trans>
              </button>
            )}
          </li>
        ))}
      </ul>

      {editing?.auditType === 'PERSONAL_PRESENTATION' && editing.worker && (
        <PersonalPresentationAuditDialog
          hotelId={hotelId}
          worker={editing.worker}
          auditId={editing.id}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
      {editing?.auditType === 'ENVIRONMENT' && (
        <EnvironmentAuditDialog
          hotelId={hotelId}
          hotelName={hotelName}
          auditId={editing.id}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
    </>
  )
}
