import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useMemo, useState, type ReactNode } from 'react'

import { useGetPoolOptionsQuery, useGetWorkerPoolQuery } from '../api/poolApi'
import { CreateAccessDialog } from '../components/CreateAccessDialog'
import { CreateWorkerDialog } from '../components/CreateWorkerDialog'
import { PoolFilters } from '../components/PoolFilters'
import { PoolRoster } from '../components/PoolRoster'
import { ANY_VALUE, EMPTY_POOL_FILTERS, type PoolFilters as Filters } from '../types/pool.types'

import fotoEquipo from '@/assets/ilustrations/pool-equipo.webp'
import { Button } from '@/shared/components/Button'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { useCan } from '@/shared/hooks/useCan'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { IS_DEV_UI } from '@/shared/lib/devMode'

export function PoolPage(): ReactNode {
  const { t } = useLingui()
  const [filters, setFilters] = useState<Filters>(EMPTY_POOL_FILTERS)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [accessFor, setAccessFor] = useState<{ id: string; fullName: string } | null>(null)
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
      <nav aria-label={t`Ruta`} className="flex items-center gap-2 text-sm text-ink-3">
        <span>
          <Trans>Reclutamiento</Trans>
        </span>
        <span aria-hidden>/</span>
        <span className="font-semibold text-ink-2">
          <Trans>Pool de Colaboradores</Trans>
        </span>
      </nav>

      {/* Misma cabecera-tarjeta que Conversión, Contratos y Propuestas: título
          a la izquierda, la foto del equipo (recortada, sin fondo) sentada en
          el borde inferior y sobresaliendo por arriba; el `clip-path` de la
          tarjeta la recorta con las esquinas redondeadas y deja 3rem arriba.
          El botón de crear (o la nota de quién da de alta) baja al texto. */}
      <header className="relative flex items-end justify-between gap-4 rounded-2xl border border-line bg-gradient-to-r from-o-50 via-surface to-surface px-6 pt-5 pb-5 [clip-path:inset(-3rem_0_0_0_round_1rem)] sm:mt-8 sm:min-h-44 sm:pr-[26rem]">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text={t`Pool de Colaboradores`} />
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-ink-3">
            {IS_DEV_UI ? (
              'personal.worker · vw_worker deriva edad y perfil completo'
            ) : (
              <Trans>
                Colaboradores con su estado en el Semáforo; los Disponibles se pueden asignar a una
                requisición
              </Trans>
            )}
            {/* Con filtros, el total es el de la CONSULTA: «0 en el pool» mentiría. */}
            {pool &&
              (isFiltered
                ? ` · ${t`${plural(pool.total, { one: '# coincide', other: '# coinciden' })}`}`
                : ` · ${t`${pool.total} en el pool`}`)}
          </p>
          <div className="mt-4 flex items-center gap-3">
            {canCreate ? (
              <Button
                variant="primary"
                onClick={() => {
                  setIsCreateOpen(true)
                }}
              >
                <Trans>Crear colaborador</Trans>
              </Button>
            ) : (
              <p className="max-w-md text-xs text-ink-3">
                <Trans>
                  El alta es de Reclutamiento: la Reclutadora captura la Fase 1 en la entrevista.
                </Trans>
              </p>
            )}
          </div>
        </div>
        <img
          src={fotoEquipo}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-2 -bottom-1 hidden h-[calc(100%+2.5rem)] w-auto object-contain object-bottom drop-shadow-[0_10px_18px_rgba(60,30,0,0.26)] sm:block"
        />
      </header>

      <PoolFilters
        isSearching={isFetching && filters.search.trim() !== ''}
        filters={filters}
        options={options}
        onChange={setFilters}
      />

      {isError && (
        <LoadError
          message={t`No se pudo cargar el Pool de Colaboradores. Revisa tu conexión e inténtalo de nuevo.`}
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
        onCreated={setAccessFor}
      />

      {/* El siguiente paso del alta: su acceso (cuenta + correo), con la
          contraseña temporal que se entrega en mano. */}
      <CreateAccessDialog
        isOpen={accessFor !== null}
        worker={accessFor}
        onClose={() => {
          setAccessFor(null)
        }}
      />
    </div>
  )
}
