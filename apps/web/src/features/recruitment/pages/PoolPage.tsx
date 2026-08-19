import { useState, type ReactNode } from 'react'

import { useGetWorkerPoolQuery } from '../api/poolApi'
import { PoolFilters } from '../components/PoolFilters'
import { PoolTable } from '../components/PoolTable'
import { EMPTY_POOL_FILTERS, type PoolFilters as Filters } from '../types/pool.types'

import { Button } from '@/shared/components/Button'
import { TableSkeleton } from '@/shared/components/TableSkeleton'

/**
 * Pool de Colaboradores: quién hay disponible y en qué situación está.
 *
 * ⚠ La vista que alimenta esta pantalla NO existe todavía en la instancia.
 * `coverage.vw_pool` está en el diagrama, pero la base solo tiene `vw_worker`,
 * `vw_client` y `vw_prospect`, y `app_user` no tiene GRANT sobre el esquema
 * `personal`. Hasta entonces vive de fixtures, igual que el resto.
 */
export function PoolPage(): ReactNode {
  const [filters, setFilters] = useState<Filters>(EMPTY_POOL_FILTERS)

  const { data: pool, isLoading, isError } = useGetWorkerPoolQuery(filters)

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
            coverage.vw_pool · vista sobre personal.worker filtrada por estado
            {pool && ` · ${String(pool.total)} en el pool`}
          </p>
        </div>

        {/* Pendiente: falta el diseño del alta de colaborador */}
        <Button variant="primary" disabled title="Pendiente: falta el diseño del alta">
          + Nuevo colaborador
        </Button>
      </header>

      <PoolFilters filters={filters} zoneNames={pool?.zoneNames ?? []} onChange={setFilters} />

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
    </div>
  )
}
