import { useState, type ReactNode } from 'react'

import { useGetPoolOptionsQuery, useGetWorkerPoolQuery } from '../api/poolApi'
import { CreateWorkerDialog } from '../components/CreateWorkerDialog'
import { PoolFilters } from '../components/PoolFilters'
import { PoolTable } from '../components/PoolTable'
import { EMPTY_POOL_FILTERS, type PoolFilters as Filters } from '../types/pool.types'

import { Button } from '@/shared/components/Button'
import { LoadError } from '@/shared/components/LoadError'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { IS_DEV_UI } from '@/shared/lib/devMode'

/**
 * Pool de Colaboradores: quién hay disponible y en qué situación está.
 * Contra `GET /workers` (el contrato real), con los filtros por id de catálogo.
 */
export function PoolPage(): ReactNode {
  const [filters, setFilters] = useState<Filters>(EMPTY_POOL_FILTERS)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editWorkerId, setEditWorkerId] = useState<string | null>(null)

  const { data: pool, isLoading, isError, refetch } = useGetWorkerPoolQuery(filters)
  const { data: options } = useGetPoolOptionsQuery()

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Ruta" className="flex items-center gap-2 text-sm text-ink-3">
        <span>Reclutamiento</span>
        <span aria-hidden>/</span>
        <span className="font-semibold text-ink-2">Pool de Colaboradores</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Pool de Colaboradores</h1>
          <p className="mt-1.5 text-sm text-ink-3">
            {IS_DEV_UI
              ? 'personal.worker · vw_worker deriva edad y perfil completo'
              : 'Colaboradores validados, listos para asignar a una requisición'}
            {pool && ` · ${String(pool.total)} en el pool`}
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setIsCreateOpen(true)
          }}
        >
          + Nuevo colaborador
        </Button>
      </header>

      <PoolFilters filters={filters} options={options} onChange={setFilters} />

      {isError && (
        <LoadError
          message="No se pudo cargar el pool."
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading && !pool ? (
        <TableSkeleton rows={6} columns={6} />
      ) : (
        pool && (
          <PoolTable
            items={pool.items}
            onEdit={(worker) => {
              setEditWorkerId(worker.id)
            }}
          />
        )
      )}

      {editWorkerId && (
        <CreateWorkerDialog
          isOpen
          workerId={editWorkerId}
          onClose={() => {
            setEditWorkerId(null)
          }}
        />
      )}

      <CreateWorkerDialog
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false)
        }}
      />
    </div>
  )
}
