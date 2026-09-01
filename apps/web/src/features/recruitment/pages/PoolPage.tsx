import { MaterialIcon } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import { useGetPoolOptionsQuery, useGetWorkerPoolQuery } from '../api/poolApi'
import { CreateWorkerDialog } from '../components/CreateWorkerDialog'
import { PoolCardBoard } from '../components/PoolCardBoard'
import { PoolFilters } from '../components/PoolFilters'
import { PoolTable } from '../components/PoolTable'
import { EMPTY_POOL_FILTERS, type PoolFilters as Filters } from '../types/pool.types'

import { Button } from '@/shared/components/Button'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { useCan } from '@/shared/hooks/useCan'
import { IS_DEV_UI } from '@/shared/lib/devMode'

export function PoolPage(): ReactNode {
  const [filters, setFilters] = useState<Filters>(EMPTY_POOL_FILTERS)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editWorkerId, setEditWorkerId] = useState<string | null>(null)
  const [view, setView] = useState<'table' | 'cards'>('table')
  const can = useCan()
  /** El alta es de Reclutamiento (recruitment:create_worker); Hotel solo consulta. */
  const canCreate = can('recruitment:create_worker')

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
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text="Pool de Colaboradores" />
          </h1>
          <p className="mt-1.5 text-sm text-ink-3">
            {IS_DEV_UI
              ? 'personal.worker · vw_worker deriva edad y perfil completo'
              : 'Colaboradores con su estado en el Semáforo; los Disponibles se pueden asignar a una requisición'}
            {pool && ` · ${String(pool.total)} en el pool`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            role="group"
            aria-label="Vista"
            className="flex rounded-md border border-line bg-surface p-0.5"
          >
            <button
              type="button"
              onClick={() => {
                setView('table')
              }}
              aria-pressed={view === 'table'}
              title="Vista de tabla"
              className={`flex cursor-pointer items-center gap-1.5 rounded px-3 py-1.5 text-sm ${
                view === 'table' ? 'bg-o-50 font-semibold text-o-700' : 'text-ink-3 hover:text-ink'
              }`}
            >
              <MaterialIcon name="table_rows" className="text-base" aria-hidden />
              Tabla
            </button>
            <button
              type="button"
              onClick={() => {
                setView('cards')
              }}
              aria-pressed={view === 'cards'}
              title="Tarjetas agrupadas por estado del Semáforo"
              className={`flex cursor-pointer items-center gap-1.5 rounded px-3 py-1.5 text-sm ${
                view === 'cards' ? 'bg-o-50 font-semibold text-o-700' : 'text-ink-3 hover:text-ink'
              }`}
            >
              <MaterialIcon name="view_kanban" className="text-base" aria-hidden />
              Tarjetas
            </button>
          </div>
          {canCreate ? (
            <Button
              variant="primary"
              onClick={() => {
                setIsCreateOpen(true)
              }}
            >
              Crear colaborador
            </Button>
          ) : (
            <p className="max-w-56 text-right text-xs text-ink-3">
              El alta es de Reclutamiento: la Reclutadora captura la Fase 1 en la entrevista.
            </p>
          )}
        </div>
      </header>

      <PoolFilters filters={filters} options={options} onChange={setFilters} />

      {isError && (
        <LoadError
          message="No se pudo cargar el Pool de Colaboradores. Revisa tu conexión e inténtalo de nuevo."
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading && !pool ? (
        <TableSkeleton rows={6} columns={6} />
      ) : (
        pool &&
        (view === 'table' ? (
          <PoolTable
            items={pool.items}
            onEdit={(worker) => {
              setEditWorkerId(worker.id)
            }}
          />
        ) : (
          <PoolCardBoard
            items={pool.items}
            onEdit={(worker) => {
              setEditWorkerId(worker.id)
            }}
          />
        ))
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
