import { useMemo, useState, type ReactNode } from 'react'

import { useGetPoolOptionsQuery, useGetWorkerPoolQuery } from '../api/poolApi'
import { CreateWorkerDialog } from '../components/CreateWorkerDialog'
import { PoolFilters } from '../components/PoolFilters'
import { PoolRoster } from '../components/PoolRoster'
import { ANY_VALUE, EMPTY_POOL_FILTERS, type PoolFilters as Filters } from '../types/pool.types'

import { Button } from '@/shared/components/Button'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { useCan } from '@/shared/hooks/useCan'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { IS_DEV_UI } from '@/shared/lib/devMode'

export function PoolPage(): ReactNode {
  const [filters, setFilters] = useState<Filters>(EMPTY_POOL_FILTERS)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editWorkerId, setEditWorkerId] = useState<string | null>(null)
  const can = useCan()
  /** El alta es de Reclutamiento (recruitment:create_worker); Hotel solo consulta. */
  const canCreate = can('recruitment:create_worker')

  /** El nombre va al servidor: se espera a que se deje de teclear; las píldoras aplican al instante. */
  const search = useDebounce(filters.search)
  const appliedFilters = useMemo(() => ({ ...filters, search }), [filters, search])

  const {
    data: pool,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetWorkerPoolQuery(appliedFilters)
  /** Cualquier filtro o texto fuera de su valor «todos». */
  const isFiltered =
    filters.search.trim() !== '' ||
    Object.entries(filters).some(([key, value]) => key !== 'search' && value !== ANY_VALUE)
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
            {/* Con filtros, el total es el de la CONSULTA: «0 en el pool» mentiría. */}
            {pool &&
              (isFiltered
                ? ` · ${String(pool.total)} ${pool.total === 1 ? 'coincide' : 'coinciden'}`
                : ` · ${String(pool.total)} en el pool`)}
          </p>
        </div>

        <div className="flex items-center gap-3">
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

      <PoolFilters
        isSearching={isFetching && filters.search.trim() !== ''}
        filters={filters}
        options={options}
        onChange={setFilters}
      />

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
        pool && (
          /* Lista-detalle (como el BDC ve a sus BDs): la fila resume con el
             estado en palabras, el panel profundiza. Tabla y Tarjetas se
             retiraron — un solo patrón de plantel en toda la app. */
          <PoolRoster
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
