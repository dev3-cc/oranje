import { statusLight } from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { PoolWorker } from '../types/pool.types'

import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  WORKER_STATUSES,
  WORKER_STATUS_LABEL,
  WORKER_STATUS_TOKEN,
} from '@/shared/constants/workerStatus'

const NEW_WINDOW_MS = 48 * 3_600_000

function isNew(worker: PoolWorker): boolean {
  return Date.now() - new Date(worker.createdAt).getTime() < NEW_WINDOW_MS
}

function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
}

export function PoolCardBoard({
  items,
  onEdit,
}: {
  items: PoolWorker[]
  onEdit: (worker: PoolWorker) => void
}): ReactNode {
  const columns = WORKER_STATUSES.map((status) => ({
    status,
    workers: items.filter((worker) => worker.status === status),
  })).filter((column) => column.workers.length > 0)

  if (columns.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
        Ningún colaborador coincide con estos filtros. Cambia o quita un filtro para ver más.
      </p>
    )
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map(({ status, workers }) => {
        const color = statusLight[WORKER_STATUS_TOKEN[status]]
        return (
          <section
            key={status}
            className="flex w-72 shrink-0 flex-col gap-3 self-start rounded-xl p-2"
            style={{ background: `linear-gradient(180deg, ${color}2e 0%, ${color}05 320px)` }}
          >
            <header className="flex items-center justify-between gap-3 px-1 pt-1">
              <StatusLightSoftBadge
                token={WORKER_STATUS_TOKEN[status]}
                label={WORKER_STATUS_LABEL[status]}
              />
              <span className="text-sm font-semibold text-ink-3">{workers.length}</span>
            </header>

            <div className="flex flex-col gap-3 pb-1">
              {workers.map((worker) => (
                <button
                  key={worker.id}
                  type="button"
                  onClick={() => {
                    onEdit(worker)
                  }}
                  className="cursor-pointer rounded-xl bg-surface p-4 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
                >
                  <span className="flex items-center gap-3">
                    {worker.photoUrl ? (
                      <img
                        src={worker.photoUrl}
                        alt=""
                        className="size-10 shrink-0 rounded-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-o-50 text-xs font-bold text-o-700"
                      >
                        {initialsOf(worker.fullName)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      {}
                      <Link
                        to={`/pool-colaboradores/${worker.id}`}
                        onClick={(event) => {
                          event.stopPropagation()
                        }}
                        className="block truncate text-sm font-bold text-ink hover:text-o-700 hover:underline"
                      >
                        {worker.fullName}
                      </Link>
                      <span className="block truncate text-xs text-ink-3">
                        {worker.zoneName} · {worker.catalogPosition}
                      </span>
                    </span>
                    {isNew(worker) && (
                      <span className="shrink-0 rounded-full bg-o-500 px-2 py-0.5 text-[10px] font-bold text-ink uppercase">
                        Nuevo
                      </span>
                    )}
                  </span>

                  <span className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-2">
                      {worker.englishLevel === '—' ? 'Sin inglés registrado' : worker.englishLevel}
                    </span>
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-2">
                      {worker.hiringModality === '—'
                        ? 'Sin modalidad definida'
                        : worker.hiringModality}
                    </span>
                    <span
                      className={
                        worker.isProfileComplete
                          ? 'rounded-full bg-green/15 px-2 py-0.5 text-[11px] text-ink-2'
                          : 'rounded-full border border-dashed border-ink-4 px-2 py-0.5 text-[11px] text-ink-3'
                      }
                    >
                      {worker.isProfileComplete ? 'perfil completo' : 'perfil incompleto'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
