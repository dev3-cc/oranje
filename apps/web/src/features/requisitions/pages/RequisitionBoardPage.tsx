import { Trans, useLingui } from '@lingui/react/macro'
import { Badge, cn, MaterialIcon } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { useGetRequisitionBoardQuery } from '../api/requisitionsApi'
import { NewRequisitionDialog } from '../components/NewRequisitionDialog'
import { RequisitionCardList } from '../components/RequisitionCardList'

import personajeContratacion from '@/assets/ilustrations/personaje-contratacion.svg'
import fotoEquipo from '@/assets/ilustrations/requisiciones-equipo.webp'
import { Button } from '@/shared/components/Button'
import { EmptyState } from '@/shared/components/EmptyState'
import { FilterReset } from '@/shared/components/FilterReset'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { SearchField } from '@/shared/components/SearchField'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import {
  REQUISITION_STATUS_LABEL,
  REQUISITION_STATUSES,
} from '@/shared/constants/requisitionStatus'
import { useCan } from '@/shared/hooks/useCan'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { matchesSearch } from '@/shared/lib/text'

/**
 * Métrica compacta para la cabecera: un Badge (shadcn) con icono, cifra y
 * pie, en vez de las cuatro tarjetas grandes que ocupaban media pantalla.
 * Con `to`, el badge es un enlace (la única métrica que lleva a algún lado).
 */
function StatBadge({
  icon,
  value,
  label,
  foot,
  tone = 'brand',
  to,
}: {
  icon: string
  value: number
  label: string
  foot: string
  tone?: 'brand' | 'danger'
  to?: string
}): ReactNode {
  const body = (
    <>
      <MaterialIcon
        name={icon}
        aria-hidden
        className={cn('text-base', tone === 'danger' ? 'text-red' : 'text-o-700')}
      />
      <span className="text-base font-bold text-ink tabular-nums">{value}</span>
      <span className="text-ink-2">{label}</span>
      <span aria-hidden className="text-ink-4">
        ·
      </span>
      <span className="text-ink-4">{foot}</span>
    </>
  )
  const className = cn(
    'h-8 gap-1.5 rounded-lg border-line bg-surface px-2.5 text-xs font-normal shadow-xs',
    to && 'hover:border-o-300 hover:bg-o-50',
  )
  return to ? (
    <Badge variant="outline" className={className} asChild>
      <Link to={to}>{body}</Link>
    </Badge>
  ) : (
    <Badge variant="outline" className={className}>
      {body}
    </Badge>
  )
}

/** El valor «todos» del select de estado (el que `FilterSelect` trae por omisión). */
const ANY = 'ALL'

/**
 * Tablero de Requisiciones del supervisor.
 *
 * Las cifras del encabezado se derivan de las filas (`fetchBoard` en
 * `requisitionsApi.ts`), no de un agregado del backend — pero `fetchBoard`
 * trae TODAS las requisiciones con `fetchAllPages` (no una sola página de
 * 100), así que las cifras son exactas aunque el back siga sin un endpoint
 * de agregados. Sin eso, con más de 100 requisiciones el encabezado habría
 * mentido, igual que le pasó a Usuarios del sistema (corregido 2026-09-09).
 *
 * El buscador y el filtro de estado recortan EN MEMORIA lo que la lista ya
 * trajo: `GET /requisitions` no acepta esos parámetros todavía.
 */
export function RequisitionBoardPage(): ReactNode {
  const { t } = useLingui()
  const [isNewOpen, setIsNewOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>(ANY)
  const can = useCan()
  /** Crear es del hotel (requisitions:create): Reclutamiento consulta el tablero sin el botón. */
  const canCreate = can('requisitions:create')

  const { data: board, isLoading, isError, refetch } = useGetRequisitionBoardQuery()

  const metrics = board?.metrics
  const items = board?.items ?? []

  /** Solo los estados que la lista trae, en el orden del semáforo, dichos en palabras. */
  const statusOptions = REQUISITION_STATUSES.filter((code) =>
    items.some((item) => item.status === code),
  ).map((code) => ({ value: code, label: REQUISITION_STATUS_LABEL[code] }))

  const visibleItems = items.filter(
    (item) =>
      (status === ANY || item.status === status) &&
      matchesSearch(search, item.number, item.hotelName),
  )
  const activeCount = [search.trim() !== '', status !== ANY].filter(Boolean).length
  const searchTerm = search.trim()

  /** Los filtros puestos, en palabras: el vacío los nombra para que se entienda por qué. */
  const statusLabel = REQUISITION_STATUS_LABEL[status as keyof typeof REQUISITION_STATUS_LABEL]
  const activeFilterLabels = [
    status !== ANY && t`Estado: ${statusLabel}`,
    searchTerm !== '' && t`búsqueda «${searchTerm}»`,
  ].filter((label): label is string => typeof label === 'string')
  const activeFiltersText = activeFilterLabels.join(` ${t`y`} `)

  function resetFilters(): void {
    setSearch('')
    setStatus(ANY)
  }

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={t`Ruta`} className="flex items-center gap-2 text-sm text-ink-3">
        <span>
          <Trans>Demanda</Trans>
        </span>
        <span aria-hidden>/</span>
        <span className="font-semibold text-ink-2">
          <Trans>Tablero de Requisiciones</Trans>
        </span>
      </nav>

      {/* Misma cabecera-tarjeta que Conversión, Contratos y Propuestas: título
          a la izquierda, la foto del equipo del hotel (recortada, sin fondo)
          sentada en el borde inferior y sobresaliendo por arriba; el
          `clip-path` de la tarjeta la recorta con las esquinas redondeadas y
          deja 3rem arriba. El botón de crear baja al bloque de texto. */}
      <header className="relative flex items-end justify-between gap-4 rounded-2xl border border-line bg-gradient-to-r from-o-50 via-surface to-surface px-6 pt-5 pb-5 [clip-path:inset(-3rem_0_0_0_round_1rem)] sm:mt-8 sm:min-h-44 sm:pr-[26rem]">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text={t`Requisiciones`} />
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-ink-3">
            {isLoading || !metrics
              ? t`Cargando requisiciones…`
              : t`${metrics.openCount} abiertas · ${metrics.awaitingAuthorization} esperan autorización · ${metrics.urgentCount} urgentes`}
          </p>
          {metrics && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatBadge
                icon="assignment"
                value={metrics.openCount}
                label={t`Abiertas`}
                foot={t`en ${metrics.openHotels} hoteles`}
              />
              <StatBadge
                icon="pending_actions"
                value={metrics.awaitingAuthorization}
                label={t`Por autorizar`}
                foot={t`${metrics.awaitingOver48h} con más de 48 h`}
                to="/requisitions/authorization"
              />
              <StatBadge
                icon="donut_small"
                value={metrics.partialCoverage}
                label={t`Cobertura parcial`}
                foot={t`${metrics.freeSlots} slots libres`}
              />
              <StatBadge
                icon="bolt"
                tone="danger"
                value={metrics.urgentCount}
                label={t`Urgentes < 72 h`}
                foot={IS_DEV_UI ? metrics.urgentRuleId : t`para el inicio`}
              />
            </div>
          )}
          {canCreate && (
            <div className="mt-4">
              <Button
                variant="primary"
                onClick={() => {
                  setIsNewOpen(true)
                }}
              >
                <Trans>Crear requisición</Trans>
              </Button>
            </div>
          )}
        </div>
        <img
          src={fotoEquipo}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-2 -bottom-1 hidden h-[calc(100%+2.5rem)] w-auto object-contain object-bottom drop-shadow-[0_10px_18px_rgba(60,30,0,0.26)] sm:block"
        />
      </header>

      {/* Quien no crea (Reclutamiento) sabe de dónde salen: el patrón de
          «quién sigue» con personaje, el mismo de Autorización. */}
      {!canCreate && (
        <NoticeCard
          image={personajeContratacion}
          title={t`Las requisiciones las crea el hotel`}
          role="status"
        >
          <Trans>
            El Supervisor, el Manager de Área o el Manager General las abren desde su zona. Aquí ves
            las que llegan, su urgencia y cómo va la cobertura.
          </Trans>
        </NoticeCard>
      )}

      {isLoading && <TableSkeleton rows={6} columns={6} />}

      {isError && (
        <LoadError
          message={t`No se pudo cargar el Tablero de Requisiciones. Revisa tu conexión e inténtalo de nuevo.`}
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {board && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <SearchField
            value={search}
            onChange={setSearch}
            label={t`Buscar requisición`}
            placeholder={t`Folio o hotel, p. ej. Xcaret…`}
            className="w-full max-w-md"
          />
          <FilterSelect
            icon="traffic"
            label={t`Estado`}
            anyLabel={t`todos`}
            value={status}
            options={statusOptions}
            onChange={setStatus}
          />
          <FilterReset activeCount={activeCount} onReset={resetFilters} />
        </div>
      )}

      {board &&
        (items.length > 0 && visibleItems.length === 0 ? (
          <EmptyState
            title={t`Ninguna requisición coincide con ${activeFiltersText}`}
            text={t`Cambia el estado o la búsqueda, o quítalos con «Quitar filtros» para volver a ver el tablero completo.`}
          />
        ) : (
          <RequisitionCardList items={visibleItems} />
        ))}

      <NewRequisitionDialog
        isOpen={isNewOpen}
        onClose={() => {
          setIsNewOpen(false)
        }}
      />
    </div>
  )
}
