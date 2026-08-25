import { useState, type ReactNode } from 'react'

import { useGetBlacklistQuery } from '../api/blacklistApi'
import { CreateBlacklistDialog } from '../components/CreateBlacklistDialog'
import { LiftBlacklistDialog } from '../components/LiftBlacklistDialog'
import {
  BLACKLIST_SOURCES,
  BLACKLIST_SOURCE_LABEL,
  EMPTY_BLACKLIST_FILTERS,
  type BlacklistFilters,
  type BlacklistRow,
} from '../types/blacklist.types'

import { Button } from '@/shared/components/Button'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { LoadError } from '@/shared/components/LoadError'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { useCan } from '@/shared/hooks/useCan'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDayMonth } from '@/shared/lib/formatters'

const HEADERS = [
  'worker_id → full_name',
  'source',
  'reason',
  'evidence_path',
  'entered_by',
  'occurred_at',
  'estado',
  '',
]

export function BlacklistPage(): ReactNode {
  const [filters, setFilters] = useState<BlacklistFilters>(EMPTY_BLACKLIST_FILTERS)
  const [liftTarget, setLiftTarget] = useState<BlacklistRow | null>(null)
  const can = useCan()
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const { data: rows = [], isLoading, isError, refetch } = useGetBlacklistQuery(filters)

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Ruta" className="flex items-center gap-2 text-sm text-ink-3">
        <span>Reclutamiento</span>
        <span aria-hidden>/</span>
        <span className="font-semibold text-ink-2">Blacklist</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Blacklist</h1>
          <p className="mt-1.5 text-sm text-ink-3">
            {IS_DEV_UI
              ? 'coverage.blacklist_entry · un colaborador activo a la vez (ux_blacklist_worker)'
              : 'Un solo veto vigente por colaborador; el historial nunca se borra'}
          </p>
        </div>

        {can('blacklist.create') && (
          <Button
            variant="primary"
            onClick={() => {
              setIsCreateOpen(true)
            }}
          >
            + Agregar a Blacklist
          </Button>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-4">
        <FilterSelect
          label="Origen"
          anyLabel="todos"
          value={filters.source}
          options={BLACKLIST_SOURCES.map((source) => ({
            value: source,
            label: BLACKLIST_SOURCE_LABEL[source],
          }))}
          onChange={(value) => {
            setFilters((previous) => ({ ...previous, source: value }))
          }}
        />

        {}
        <FilterSelect
          label="Estado"
          anyLabel="historial completo"
          value={filters.onlyActive ? 'ACTIVE' : 'ALL'}
          options={[{ value: 'ACTIVE', label: 'vigentes' }]}
          onChange={(value) => {
            setFilters((previous) => ({ ...previous, onlyActive: value === 'ACTIVE' }))
          }}
        />
      </div>

      {isError && (
        <LoadError
          message="No se pudo cargar la Blacklist."
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading && rows.length === 0 ? (
        <TableSkeleton rows={4} columns={7} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[72rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {HEADERS.map((header, index) => (
                  <th
                    key={header === '' ? `empty-${String(index)}` : header}
                    scope="col"
                    className="px-4 py-3 text-xs font-semibold tracking-wide text-ink-3 uppercase"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={HEADERS.length} className="px-4 py-8 text-center text-sm text-ink-3">
                    Nadie en la Blacklist con este filtro.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-3 text-sm font-semibold whitespace-nowrap text-ink">
                    {row.workerName}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-2">{row.source}</td>
                  <td className="max-w-md px-4 py-3 text-sm text-ink-2">{row.reason}</td>
                  <td className="px-4 py-3 text-sm text-ink-3">{row.evidencePath ?? '—'}</td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap text-ink-2">
                    {row.enteredByName}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap text-ink-3">
                    {formatDayMonth(row.occurredAt)}
                  </td>
                  <td className="px-4 py-3">
                    {row.isActive ? (
                      <span className="inline-flex rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-surface">
                        Vigente
                      </span>
                    ) : (
                      <span
                        className="inline-flex rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-3"
                        title={row.liftReason ?? undefined}
                      >
                        Levantada
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {}
                    {row.isActive && can('blacklist.lift') && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setLiftTarget(row)
                        }}
                      >
                        Levantar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-ink-3">
        Tres reglas que el motor hace cumplir: un colaborador en{' '}
        <span className="font-semibold">Gris</span> (accidentado) no se puede vetar; solo hay un
        veto vigente a la vez y el historial nunca se borra; y al levantarlo la persona vuelve a{' '}
        <span className="font-semibold">Blanco</span>, reingresando por la validación de la
        Reclutadora.
      </p>

      <LiftBlacklistDialog
        row={liftTarget}
        onClose={() => {
          setLiftTarget(null)
        }}
      />

      <CreateBlacklistDialog
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false)
        }}
      />
    </div>
  )
}
