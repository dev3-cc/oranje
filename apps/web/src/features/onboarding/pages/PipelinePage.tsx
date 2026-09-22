import { DragDropContext, type DragStart, type DropResult } from '@hello-pangea/dnd'
import { Trans, useLingui } from '@lingui/react/macro'
import { Skeleton, cn } from '@oranje/ui'
import { useReducedMotion } from 'framer-motion'
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'

import { useGetPipelineBoardQuery, useGetZonesQuery } from '../api/onboardingApi'
import { ChangeStatusDialog } from '../components/ChangeStatusDialog'
import { PipelineColumn } from '../components/PipelineColumn'
import { ProspectFormDialog } from '../components/ProspectFormDialog'
import { SemaforoHelpButton } from '../components/SemaforoHelpDialog'
import { usePipelineFilters } from '../hooks/usePipelineFilters'
import type { ProspectSummary } from '../types/prospect.types'

import { useGetSessionQuery } from '@/app/sessionApi'
import fotoPipeline from '@/assets/ilustrations/pipeline-equipo.webp'
import pipelineIllustration from '@/assets/ilustrations/pipeline.svg'
import { Button } from '@/shared/components/Button'
import { FilterReset } from '@/shared/components/FilterReset'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import {
  ONBOARDING_TRANSITIONS,
  PIPELINE_COLUMNS,
  type OnboardingStatus,
} from '@/shared/constants/onboardingStatus'
import { useCan } from '@/shared/hooks/useCan'

/** El globo carga aparte: three-globe + continentes no pesan en el chunk base. */
const HotelGlobeCard = lazy(() =>
  import('../components/HotelGlobeCard').then((module) => ({ default: module.HotelGlobeCard })),
)

/** Estilo común de los chips de filtro, para que el que es botón no se distinga. */
const FILTER_CHIP_CLASS =
  'rounded-full bg-surface px-4 py-2 text-sm text-ink-2 whitespace-nowrap shadow-sm'

/** El valor «todos» de los selects de filtro (el que `FilterSelect` trae por omisión). */
const ANY = 'ALL'

/**
 * El BD ve solo lo suyo (la API acota por permiso): para él el dueño es fijo
 * y el filtro no se enseña. El BDC —y quien pueda ver a otros— sí elige.
 */
const BD_ROLE = 'ROL-V-01'

export function PipelinePage(): ReactNode {
  const { t } = useLingui()
  const navigate = useNavigate()
  const can = useCan()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const { filters, isStaleOnly, activeCount, toggleStaleOnly, setZone, setOwnerId, reset } =
    usePipelineFilters()
  const { data: session } = useGetSessionQuery()
  const { data: zones = [] } = useGetZonesQuery()
  const { data: board, isLoading, isError, refetch } = useGetPipelineBoardQuery(filters)

  const canFilterOwner = session !== undefined && session.roleId !== BD_ROLE
  const zoneOptions = zones.map((zone) => ({
    value: zone.id,
    label: zone.label.replace(/^Zona\s+/i, ''),
  }))

  /**
   * El tablero solo pinta prospectos ABIERTOS a propósito — los convertidos
   * (Naranja) se ven en Clientes Activos (BD/BDC no los necesitan aquí). El
   * Observador sí quiere ver el ciclo completo, así que gana la columna
   * Naranja además de las 6 abiertas (Hugo, 2026-09-21: "no se ve el naranja
   * status, cuando ya es cliente, debería").
   */
  const visibleColumns: readonly OnboardingStatus[] =
    session?.roleId === 'ROL-OBS-01' ? [...PIPELINE_COLUMNS, 'ORANGE'] : PIPELINE_COLUMNS

  /** Los filtros puestos, en palabras: el vacío los nombra para que se entienda por qué. */
  const activeFilterLabels = [
    filters.zone !== null &&
      t`Zona: ${zoneOptions.find((zone) => zone.value === filters.zone)?.label ?? filters.zone}`,
    filters.ownerId !== null && t`Dueño: yo`,
    isStaleOnly && t`Sin actividad 7+ días`,
  ].filter((label): label is string => typeof label === 'string')

  /**
   * Drag-and-drop del semáforo: soltar la tarjeta en otra columna NO cambia
   * nada por sí solo — abre el MISMO modal de cambio de estado con el destino
   * preseleccionado, y el backend sigue mandando (transiciones y motivo).
   * Mientras se arrastra, las columnas sin arista desde el estado origen se
   * deshabilitan con las transiciones transcritas del seed.
   */
  const [draggingFrom, setDraggingFrom] = useState<OnboardingStatus | null>(null)
  const [pendingMove, setPendingMove] = useState<{
    prospect: ProspectSummary
    toStatus: OnboardingStatus
  } | null>(null)

  function handleDragStart(start: DragStart): void {
    setDraggingFrom(start.source.droppableId as OnboardingStatus)
  }

  function handleDragEnd(result: DropResult): void {
    setDraggingFrom(null)
    const target = result.destination?.droppableId as OnboardingStatus | undefined
    if (!target || target === result.source.droppableId) return
    const prospect = board?.items.find((item) => item.id === result.draggableId)
    if (prospect) setPendingMove({ prospect, toStatus: target })
  }

  function isDropDisabledFor(status: OnboardingStatus): boolean {
    if (draggingFrom === null || draggingFrom === status) return false
    return !ONBOARDING_TRANSITIONS[draggingFrom].includes(status)
  }

  /**
   * Guiño de «esto se desliza»: al cargar el tablero por primera vez, el
   * kanban se mueve un poco a la derecha y regresa solo — sin flecha ni
   * texto, nada más el gesto (Hugo, 2026-09-15: «que sepa que se puede
   * mover»). Una sola vez por visita a la página, y nunca con reduced motion.
   */
  const scrollRef = useRef<HTMLDivElement>(null)
  const hasPlayedHintRef = useRef(false)
  const reduceMotion = useReducedMotion() ?? false
  useEffect(() => {
    if (!board || board.items.length === 0 || hasPlayedHintRef.current || reduceMotion) return
    hasPlayedHintRef.current = true
    const el = scrollRef.current
    // jsdom (specs) no implementa scrollTo — sin esto el timer revienta tarde,
    // fuera del propio test, como un error suelto en la suite.
    if (!el || typeof el.scrollTo !== 'function') return
    const timers = [
      setTimeout(() => {
        el.scrollTo({ left: 96, behavior: 'smooth' })
      }, 400),
      setTimeout(() => {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      }, 950),
    ]
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [board, reduceMotion])

  return (
    <div className="flex flex-col gap-6">
      {/* El Observador llega aquí desde su pantalla de solo lectura; el
          Pipeline no tiene breadcrumb propio, así que esta línea es solo
          suya (Hugo, 2026-09-21). Sin flecha propia: el shell (AppShell) ya
          pinta la suya para esta ruta — dos flechas confundían (Hugo, mismo día). */}
      {session?.roleId === 'ROL-OBS-01' && (
        <nav aria-label={t`Ruta`} className="text-sm text-ink-3">
          <Link to="/observability" className="hover:text-o-700">
            <Trans>Observador</Trans>
          </Link>
        </nav>
      )}

      {/* Misma cabecera-tarjeta que Conversión, Contratos y Propuestas: título
          a la izquierda, la foto (recortada, sin fondo: la mujer y los
          post-its, sin sus textos) sentada en el borde inferior y sobresaliendo
          por arriba; el `clip-path` de la tarjeta la recorta con las esquinas
          redondeadas y deja 3rem arriba. Los botones bajan al bloque de texto. */}
      <header className="relative flex items-end justify-between gap-4 rounded-2xl border border-line bg-gradient-to-r from-o-50 via-surface to-surface px-6 pt-5 pb-5 [clip-path:inset(-3rem_0_0_0_round_1rem)] sm:mt-8 sm:min-h-44 sm:pr-96">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              <FoldText text={t`Pipeline`} />
            </h1>
            <SemaforoHelpButton />
          </div>
          <p className="mt-1 max-w-xl text-sm text-ink-3">
            {isLoading
              ? t`Cargando prospectos…`
              : t`${board?.openCount ?? 0} prospectos abiertos · ${board?.zoneCount ?? 0} zonas`}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* Pendiente: ninguna de las dos pantallas destino está diseñada todavía */}
            <Button disabled title={t`La vista tabla llega pronto`}>
              <Trans>Vista tabla</Trans>
            </Button>
            {can('pipeline:create_prospect') && (
              <Button
                variant="primary"
                onClick={() => {
                  setIsFormOpen(true)
                }}
              >
                <Trans>Nuevo prospecto</Trans>
              </Button>
            )}
          </div>
        </div>
        <img
          src={fotoPipeline}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-2 -bottom-1 hidden h-[calc(100%+2.5rem)] w-auto object-contain object-bottom drop-shadow-[0_10px_18px_rgba(60,30,0,0.26)] md:block"
        />
      </header>

      <div className="flex flex-wrap items-center gap-3">
        {/* Zona y Dueño viajan al endpoint (`zoneId`, `ownerUserId`): son
            filtros de verdad, con el select-píldora de la casa. */}
        <FilterSelect
          icon="place"
          label={t`Zona`}
          anyLabel={t`todas`}
          value={filters.zone ?? ANY}
          anyValue={ANY}
          options={zoneOptions}
          onChange={(value) => {
            setZone(value === ANY ? null : value)
          }}
        />
        {canFilterOwner && (
          <FilterSelect
            icon="person"
            label={t`Dueño`}
            anyLabel={t`todos`}
            value={filters.ownerId ?? ANY}
            anyValue={ANY}
            options={[{ value: session.id, label: t`yo` }]}
            onChange={(value) => {
              setOwnerId(value === ANY ? null : value)
            }}
          />
        )}
        <button
          type="button"
          onClick={toggleStaleOnly}
          aria-pressed={isStaleOnly}
          className={cn(
            FILTER_CHIP_CLASS,
            'transition-colors hover:bg-surface-2',
            isStaleOnly && 'bg-o-50 font-semibold text-o-700 ring-1 ring-o-500',
          )}
        >
          <Trans>Sin actividad 7+ días</Trans>
        </button>
        <FilterReset activeCount={activeCount} onReset={reset} />
      </div>

      {isError && (
        <LoadError
          message={t`No se pudo cargar el Pipeline. Reintenta en unos segundos.`}
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading && (
        <div className="flex gap-4 overflow-hidden" aria-hidden>
          {PIPELINE_COLUMNS.slice(0, 4).map((status) => (
            <div key={status} className="flex w-72 shrink-0 flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-8 rounded-full" />
              </div>
              {[0, 1, 2].map((card) => (
                <div
                  key={card}
                  className="flex flex-col gap-2 overflow-hidden rounded-2xl bg-surface pb-4 shadow-md"
                >
                  <Skeleton className="h-24 w-full rounded-none" />
                  <div className="flex flex-col gap-2 px-4">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-32" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {board && board.items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line px-6 py-12 text-center">
          <img src={pipelineIllustration} alt="" aria-hidden className="h-32 w-auto" />
          {activeFilterLabels.length > 0 ? (
            /* El vacío nombra el filtro que lo causa: sin eso se lee como
               «no hay prospectos» cuando solo están fuera del recorte. */
            <>
              <p className="text-base font-semibold text-ink">
                <Trans>Ningún prospecto coincide con {activeFilterLabels.join(' · ')}</Trans>
              </p>
              <p className="max-w-md text-sm text-ink-3">
                <Trans>
                  Cambia ese filtro o quítalo con «Quitar filtros» para volver a ver el tablero
                  completo.
                </Trans>
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-ink">
                <Trans>Aún no hay prospectos abiertos</Trans>
              </p>
              <p className="max-w-md text-sm text-ink-3">
                <Trans>
                  Da de alta el primero con «Nuevo prospecto»: el ciclo arranca en Gris.
                </Trans>
              </p>
            </>
          )}
        </div>
      )}

      {board && board.items.length > 0 && (
        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-4">
            {visibleColumns.map((status) => (
              <PipelineColumn
                key={status}
                status={status}
                prospects={board.items.filter((item) => item.status === status)}
                isDropDisabled={isDropDisabledFor(status)}
              />
            ))}
          </div>
        </DragDropContext>
      )}

      {/* El flujo del semáforo vive ahora en el Dashboard; aquí queda el territorio. */}
      {board && (
        <Suspense fallback={null}>
          <HotelGlobeCard />
        </Suspense>
      )}

      <ProspectFormDialog
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
        }}
        onCreated={(created) => {
          // Tras el alta se entra a trabajar el prospecto recién abierto.
          void navigate(`/pipeline/${created.id}`)
        }}
      />

      {pendingMove && (
        <ChangeStatusDialog
          isOpen
          onClose={() => {
            setPendingMove(null)
          }}
          prospectId={pendingMove.prospect.id}
          hotelName={pendingMove.prospect.hotelName}
          currentStatus={pendingMove.prospect.status}
          presetStatus={pendingMove.toStatus}
        />
      )}
    </div>
  )
}
