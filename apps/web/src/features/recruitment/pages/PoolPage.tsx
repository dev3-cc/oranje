import { useState, type ReactNode } from 'react'

import { useGetPoolOptionsQuery, useGetWorkerPoolQuery } from '../api/poolApi'
import { CreateWorkerDialog } from '../components/CreateWorkerDialog'
import { PoolFilters } from '../components/PoolFilters'
import { PoolTable } from '../components/PoolTable'
import { EMPTY_POOL_FILTERS, type PoolFilters as Filters } from '../types/pool.types'

import { Button } from '@/shared/components/Button'
import { TableSkeleton } from '@/shared/components/TableSkeleton'

/**
 * Pool de Colaboradores: quién hay disponible y en qué situación está.
 * Contra `GET /workers` (el contrato real), con los filtros por id de catálogo.
 */
export function PoolPage(): ReactNode {
  const [filters, setFilters] = useState<Filters>(EMPTY_POOL_FILTERS)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const { data: pool, isLoading, isError } = useGetWorkerPoolQuery(filters)
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
            personal.worker · vw_worker deriva edad y perfil completo
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
        <p className="rounded-lg border border-line bg-surface p-6 text-sm text-red">
          No se pudo cargar el pool. Reintenta en unos segundos.
        </p>
      )}

      {isLoading && !pool ? (
        <TableSkeleton rows={6} columns={6} />
      ) : (
        pool && <PoolTable items={pool.items} />
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
