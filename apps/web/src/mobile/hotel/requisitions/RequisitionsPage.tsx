import { Trans, useLingui } from '@lingui/react/macro'
import { cn, MaterialIcon } from '@oranje/ui'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'

import { CoverageBar, RequisitionStatusChip, UrgencyChip } from './requisitionParts'
import { useAppRequisitionsQuery, type AppRequisitionRow } from './requisitionsAppApi'

import personajeBienvenida from '@/assets/ilustrations/personaje-bienvenida.svg'
import { EmptyState } from '@/shared/components/EmptyState'
import { LoadError } from '@/shared/components/LoadError'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatDayMonth } from '@/shared/lib/formatters'

type Filter = 'all' | 'draft' | 'open' | 'covered'

const FILTERS: readonly Filter[] = ['all', 'draft', 'open', 'covered']

/** El filtro llega en `?filter=` (las métricas del Inicio): un valor desconocido es «Todas». */
function filterFrom(value: string | null): Filter {
  return FILTERS.find((item) => item === value) ?? 'all'
}

/** Abiertas = autorizadas o en trabajo de Reclutamiento; no cuenta borradores ni eliminadas. */
const OPEN: ReadonlySet<string> = new Set(['GREEN', 'YELLOW', 'RED'])

function matches(row: AppRequisitionRow, filter: Filter): boolean {
  if (filter === 'draft') return row.status === 'APPLE_GREEN'
  if (filter === 'open') return OPEN.has(row.status)
  if (filter === 'covered') return row.status === 'LIGHT_BLUE'
  return row.status !== 'PURPLE'
}

/**
 * Las requisiciones del hotel en la app. El API ya recorta por alcance: el
 * Manager General ve todo el hotel; el Manager de Área, su departamento; el
 * Supervisor, el hotel (mismo criterio que el web). Las eliminadas no se
 * listan: no hay nada que hacer con ellas.
 */
export function RequisitionsPage(): ReactNode {
  const { t } = useLingui()
  const can = useCan()
  const { data: rows, isLoading, error, refetch, isFetching } = useAppRequisitionsQuery()
  const [searchParams] = useSearchParams()
  const [filter, setFilter] = useState<Filter>(() => filterFrom(searchParams.get('filter')))

  const counts = useMemo(() => {
    const list = rows ?? []
    return {
      all: list.filter((row) => matches(row, 'all')).length,
      draft: list.filter((row) => matches(row, 'draft')).length,
      open: list.filter((row) => matches(row, 'open')).length,
      covered: list.filter((row) => matches(row, 'covered')).length,
    }
  }, [rows])

  const visible = (rows ?? []).filter((row) => matches(row, filter))
  const canCreate = can('requisitions:create')

  const filters: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: t`Todas` },
    { id: 'draft', label: t`Por autorizar` },
    { id: 'open', label: t`Abiertas` },
    { id: 'covered', label: t`Cubiertas` },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">
          <Trans>Requisiciones</Trans>
        </h1>
        {canCreate && (
          <Link
            to="/hotel/requisitions/new"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-o-300 px-4 text-sm font-semibold text-ink shadow-xs active:bg-o-400"
          >
            <MaterialIcon name="add" className="text-lg" aria-hidden />
            <Trans>Nueva</Trans>
          </Link>
        )}
      </div>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1" role="tablist">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            onClick={() => {
              setFilter(item.id)
            }}
            className={cn(
              'flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors',
              filter === item.id
                ? 'border-ink bg-ink text-surface'
                : 'border-line bg-surface text-ink-2',
            )}
          >
            {item.label}
            <span
              className={cn(
                'rounded-full px-1.5 text-xs tabular-nums',
                filter === item.id ? 'bg-surface/20' : 'bg-surface-2',
              )}
            >
              {counts[item.id]}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3" aria-busy aria-label={t`Cargando`}>
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-32 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      ) : error ? (
        <LoadError
          message={apiErrorMessage(error, {
            fallback: t`No se pudieron cargar las requisiciones.`,
          })}
          onRetry={() => {
            void refetch()
          }}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          image={personajeBienvenida}
          title={t`Aún no hay requisiciones`}
          text={
            filter === 'all'
              ? canCreate
                ? t`Cuando pidas personal, tus requisiciones aparecen aquí.`
                : t`Cuando tu hotel pida personal, las requisiciones aparecen aquí.`
              : t`No hay requisiciones en este filtro.`
          }
        />
      ) : (
        <ul className={cn('flex flex-col gap-3', isFetching && 'opacity-70')}>
          {visible.map((row) => (
            <li key={row.id}>
              <Link
                to={`/hotel/requisitions/${row.id}`}
                className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-xs active:bg-surface-2"
              >
                {/* Folio y estado arriba; el departamento abajo, a todo lo ancho: un
                    chip largo («Cubierta totalmente») ya no lo corta. */}
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs text-ink-3">{row.number}</p>
                  <RequisitionStatusChip status={row.status} />
                </div>
                <p className="-mt-1 text-base font-semibold text-ink">{row.department}</p>
                <CoverageBar filled={row.filled} total={row.total} />
                <div className="flex items-center justify-between gap-3 text-xs text-ink-3">
                  {/* Cubierta o eliminada, la urgencia ya no dice nada. */}
                  {row.status === 'LIGHT_BLUE' || row.status === 'PURPLE' ? (
                    <span />
                  ) : (
                    <UrgencyChip urgency={row.urgency} />
                  )}
                  {row.startDate && (
                    <span>
                      <Trans>Inicia {formatDayMonth(row.startDate)}</Trans>
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
