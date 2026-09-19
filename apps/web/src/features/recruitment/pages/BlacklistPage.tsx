import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@oranje/ui'
import { useMemo, useState, type ReactNode } from 'react'

import { useGetBlacklistQuery } from '../api/blacklistApi'
import { CreateBlacklistDialog } from '../components/CreateBlacklistDialog'
import { LiftBlacklistDialog } from '../components/LiftBlacklistDialog'
import {
  ANY_VALUE,
  BLACKLIST_SOURCES,
  BLACKLIST_SOURCE_LABEL,
  EMPTY_BLACKLIST_FILTERS,
  type BlacklistFilters,
  type BlacklistRow,
} from '../types/blacklist.types'

import personajeAccesoProtegido from '@/assets/ilustrations/personaje-acceso-protegido.svg'
import { Button } from '@/shared/components/Button'
import { FilterReset } from '@/shared/components/FilterReset'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { SearchField } from '@/shared/components/SearchField'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { useCan } from '@/shared/hooks/useCan'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDayMonth } from '@/shared/lib/formatters'
import { matchesSearch } from '@/shared/lib/text'

const DEV_HEADERS = [
  'worker_id → full_name',
  'source',
  'reason',
  'evidence_path',
  'entered_by',
  'occurred_at',
  'estado',
  '',
]

/** Se traducen al pintar con `i18n._()` (D-36); `null` = la columna de acciones, sin encabezado. */
const HEADER_LABELS: readonly (MessageDescriptor | null)[] = [
  msg`Colaborador`,
  msg`Origen`,
  msg`Motivo`,
  msg`Evidencia`,
  msg`Registró`,
  msg`Fecha`,
  msg`Estado`,
  null,
]

export function BlacklistPage(): ReactNode {
  const { t, i18n } = useLingui()
  const [filters, setFilters] = useState<BlacklistFilters>(EMPTY_BLACKLIST_FILTERS)
  const [search, setSearch] = useState('')
  const [liftTarget, setLiftTarget] = useState<BlacklistRow | null>(null)
  const can = useCan()
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const { data: rows = [], isLoading, isError, refetch } = useGetBlacklistQuery(filters)

  const headers = IS_DEV_UI
    ? DEV_HEADERS
    : HEADER_LABELS.map((label) => (label === null ? '' : i18n._(label)))

  /* El nombre se filtra aquí, sobre lo que ya llegó: la API no acepta texto. */
  const visibleRows = useMemo(
    () => rows.filter((row) => matchesSearch(search, row.workerName)),
    [rows, search],
  )

  /* Lo que cuenta como filtro es lo que se APARTA del arranque: la Blacklist
     nace en «vigentes» (es lo que se consulta), así que abrir el historial
     sí es un filtro y volver a vigentes es quitarlo. Una página recién
     abierta nunca ofrece «Quitar filtros». */
  const activeFilters =
    (search.trim() !== '' ? 1 : 0) +
    (filters.source !== ANY_VALUE ? 1 : 0) +
    (filters.onlyActive !== EMPTY_BLACKLIST_FILTERS.onlyActive ? 1 : 0)

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={t`Ruta`} className="flex items-center gap-2 text-sm text-ink-3">
        <span>
          <Trans>Reclutamiento</Trans>
        </span>
        <span aria-hidden>/</span>
        <span className="font-semibold text-ink-2">
          <Trans>Blacklist</Trans>
        </span>
      </nav>

      {/* Quién sigue: el veto vigente lo levanta el Administrador, no este departamento. */}
      {!can('blacklist.lift') && visibleRows.some((row) => row.isActive) && (
        <NoticeCard
          image={personajeAccesoProtegido}
          title={t`Levantar un veto es del Administrador`}
          role="status"
        >
          <Trans>
            Un veto vigente solo lo levanta el Administrador. Al levantarlo, el colaborador vuelve a
            Blanco y pasa otra vez por la validación de la Reclutadora antes de ser asignable.
          </Trans>
        </NoticeCard>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text={t`Blacklist`} />
          </h1>
          <p className="mt-1.5 text-sm text-ink-3">
            {IS_DEV_UI ? (
              'coverage.blacklist_entry · un colaborador activo a la vez (ux_blacklist_worker)'
            ) : (
              <Trans>Un solo veto vigente por colaborador; el historial nunca se borra</Trans>
            )}
          </p>
        </div>

        {can('blacklist.create') && (
          <Button
            variant="primary"
            onClick={() => {
              setIsCreateOpen(true)
            }}
          >
            <Trans>Agregar a Blacklist</Trans>
          </Button>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-4">
        <SearchField
          value={search}
          onChange={setSearch}
          label={t`Buscar colaborador`}
          placeholder={t`Nombre del colaborador, p. ej. Ana Rivera…`}
          className="w-72"
        />

        <FilterSelect
          label={t`Origen`}
          anyLabel={t`todos`}
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
          label={t`Estado`}
          anyLabel={t`historial completo`}
          value={filters.onlyActive ? 'ACTIVE' : 'ALL'}
          options={[{ value: 'ACTIVE', label: t`vigentes` }]}
          onChange={(value) => {
            setFilters((previous) => ({ ...previous, onlyActive: value === 'ACTIVE' }))
          }}
        />

        <FilterReset
          activeCount={activeFilters}
          onReset={() => {
            setSearch('')
            setFilters(EMPTY_BLACKLIST_FILTERS)
          }}
        />
      </div>

      {isError && (
        <LoadError
          message={t`No se pudo cargar la Blacklist. Revisa tu conexión e inténtalo de nuevo.`}
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading && rows.length === 0 ? (
        <TableSkeleton rows={4} columns={7} />
      ) : (
        <div className="rounded-lg border border-line bg-surface">
          <Table className="min-w-[72rem] text-left">
            <TableHeader>
              <TableRow className="border-line">
                {headers.map((header, index) => (
                  <TableHead
                    key={header === '' ? `empty-${String(index)}` : header}
                    scope="col"
                    className="px-4 py-3 text-xs font-semibold tracking-wide text-ink-3 uppercase"
                  >
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={headers.length}
                    className="px-4 py-8 text-center text-sm text-ink-3"
                  >
                    {rows.length > 0 && search.trim() !== ''
                      ? t`Ningún veto es de alguien llamado «${search.trim()}». Prueba otro nombre o quita la búsqueda.`
                      : t`No hay vetos con estos filtros. Prueba con otro origen o con el historial completo.`}
                  </TableCell>
                </TableRow>
              )}
              {visibleRows.map((row) => (
                <TableRow key={row.id} className="border-line">
                  <TableCell className="px-4 py-3 text-sm font-semibold whitespace-nowrap text-ink">
                    {row.workerName}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-ink-2">
                    {IS_DEV_UI ? row.source : BLACKLIST_SOURCE_LABEL[row.source]}
                  </TableCell>
                  <TableCell className="max-w-md px-4 py-3 text-sm whitespace-normal text-ink-2">
                    {row.reason}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-ink-3">
                    {row.evidencePath ?? '—'}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm whitespace-nowrap text-ink-2">
                    {row.enteredByName}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm whitespace-nowrap text-ink-3">
                    {formatDayMonth(row.occurredAt)}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {row.isActive ? (
                      <span className="inline-flex rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-surface">
                        <Trans>Vigente</Trans>
                      </span>
                    ) : (
                      <span
                        className="inline-flex rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-3"
                        title={row.liftReason ?? undefined}
                      >
                        <Trans>Levantada</Trans>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    {}
                    {row.isActive && can('blacklist.lift') && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setLiftTarget(row)
                        }}
                      >
                        <Trans>Levantar veto</Trans>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-ink-3">
        <Trans>
          Tres reglas que el sistema hace cumplir siempre: un colaborador en{' '}
          <span className="font-semibold">Gris</span> (accidentado) no se puede vetar; solo hay un
          veto vigente a la vez y el historial nunca se borra; y al levantarlo la persona vuelve a{' '}
          <span className="font-semibold">Blanco</span>, reingresando por la validación de la
          Reclutadora.
        </Trans>
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
