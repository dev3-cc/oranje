import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

import { useGetLastAuditPerWorkerQuery } from '../api/auditsApi'
import type { LastAuditPerWorker } from '../types/audit.types'

import { EmptyState } from '@/shared/components/EmptyState'
import { LoadError } from '@/shared/components/LoadError'
import { MagicCard } from '@/shared/components/MagicCard'
import { Modal } from '@/shared/components/Modal'
import { TableSkeleton } from '@/shared/components/TableSkeleton'

const MS_PER_DAY = 86_400_000

/**
 * "Hoy" solo, sin verbo, se leía como "audítalo hoy" — lo contrario de lo que
 * dice (ya se hizo). Todo lo que NO es "Sin auditar" empieza con "Auditado"
 * para que la pastilla se lea siempre como estado, nunca como instrucción.
 */
function sinceLabel(lastAuditedAt: string | null): string {
  if (lastAuditedAt === null) return 'Sin auditar'
  const days = Math.floor((Date.now() - new Date(lastAuditedAt).getTime()) / MS_PER_DAY)
  if (days <= 0) return 'Auditado hoy'
  if (days === 1) return 'Auditado ayer'
  return `Auditado hace ${String(days)} días`
}

/** Los que más lo necesitan primero: nunca auditados, luego el más antiguo. */
function sortByUrgency(rows: LastAuditPerWorker[]): LastAuditPerWorker[] {
  return [...rows].sort((a, b) => {
    if (a.lastAuditedAt === null && b.lastAuditedAt === null)
      return a.workerName.localeCompare(b.workerName)
    if (a.lastAuditedAt === null) return -1
    if (b.lastAuditedAt === null) return 1
    return a.lastAuditedAt.localeCompare(b.lastAuditedAt)
  })
}

function toneOf(lastAuditedAt: string | null): string {
  if (lastAuditedAt === null) return 'border-red/40 bg-red/10 text-red'
  const days = Math.floor((Date.now() - new Date(lastAuditedAt).getTime()) / MS_PER_DAY)
  if (days >= 14) return 'border-yellow/50 bg-yellow/15 text-ink-2'
  return 'border-line bg-surface-3 text-ink-2'
}

/**
 * "Auditoría de personal": el roster del hotel con cuánto lleva cada quien
 * sin su Presentación Personal — el Supervisor elige a quién le toca. Fuente:
 * `GET /audits/last-per-worker`, ya el orden por urgencia (nunca auditado
 * primero).
 */
export function AuditWorkerList({
  hotelId,
  onSelect,
  onClose,
}: {
  hotelId: string
  onSelect: (worker: { id: string; fullName: string; photoUrl: string | null }) => void
  onClose: () => void
}): ReactNode {
  const { data, isLoading, isError, refetch } = useGetLastAuditPerWorkerQuery(hotelId)
  const rows = data ? sortByUrgency(data) : []

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Auditoría de personal"
      description="Elige a quién auditar. El tiempo sin auditar te dice por dónde empezar."
      className="max-w-lg"
    >
      {isLoading ? (
        <TableSkeleton rows={4} columns={2} />
      ) : isError ? (
        <LoadError
          message="No se pudo cargar el plantel del hotel. Inténtalo de nuevo."
          onRetry={() => {
            void refetch()
          }}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Este hotel no tiene colaboradores asignados"
          text="Cuando el Schedule programe a alguien en este hotel, aparecerá aquí para auditarlo."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.workerId}>
              <MagicCard className="rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    onSelect({ id: row.workerId, fullName: row.workerName, photoUrl: row.photoUrl })
                  }}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {row.photoUrl ? (
                      <img
                        src={row.photoUrl}
                        alt=""
                        className="size-8 shrink-0 rounded-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-o-500 text-xs font-bold text-ink"
                      >
                        {row.workerName.charAt(0)}
                      </span>
                    )}
                    <span className="truncate text-sm font-semibold text-ink">
                      {row.workerName}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold',
                      toneOf(row.lastAuditedAt),
                    )}
                  >
                    {sinceLabel(row.lastAuditedAt)}
                  </span>
                </button>
              </MagicCard>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
