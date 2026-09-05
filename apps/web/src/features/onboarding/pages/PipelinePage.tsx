import { DragDropContext, type DragStart, type DropResult } from '@hello-pangea/dnd'
import { Skeleton, cn } from '@oranje/ui'
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { useGetPipelineBoardQuery, useGetZonesQuery } from '../api/onboardingApi'
import { ChangeStatusDialog } from '../components/ChangeStatusDialog'
import { PipelineColumn } from '../components/PipelineColumn'
import { ProspectFormDialog } from '../components/ProspectFormDialog'
import { SemaforoHelpButton } from '../components/SemaforoHelpDialog'
import { usePipelineFilters } from '../hooks/usePipelineFilters'
import type { ProspectSummary } from '../types/prospect.types'

import { useGetSessionQuery } from '@/app/sessionApi'
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
  const navigate = useNavigate()
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

  /** Los filtros puestos, en palabras: el vacío los nombra para que se entienda por qué. */
  const activeFilterLabels = [
    filters.zone !== null &&
      `Zona: ${zoneOptions.find((zone) => zone.value === filters.zone)?.label ?? filters.zone}`,
    filters.ownerId !== null && 'Dueño: yo',
    isStaleOnly && 'Sin actividad 7+ días',
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

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              <FoldText text="Pipeline" />
            </h1>
            <SemaforoHelpButton />
          </div>
          <p className="mt-1 text-sm text-ink-3">
            {isLoading
              ? 'Cargando prospectos…'
              : `${board?.openCount ?? 0} prospectos abiertos · ${board?.zoneCount ?? 0} zonas`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Pendiente: ninguna de las dos pantallas destino está diseñada todavía */}
          <Button disabled title="La vista tabla llega pronto">
            Vista tabla
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setIsFormOpen(true)
            }}
          >
            Nuevo prospecto
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        {/* Zona y Dueño viajan al endpoint (`zoneId`, `ownerUserId`): son
            filtros de verdad, con el select-píldora de la casa. */}
        <FilterSelect
          icon="place"
          label="Zona"
          anyLabel="todas"
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
            label="Dueño"
            anyLabel="todos"
            value={filters.ownerId ?? ANY}
            anyValue={ANY}
            options={[{ value: session.id, label: 'yo' }]}
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
          Sin actividad 7+ días
        </button>
        <FilterReset activeCount={activeCount} onReset={reset} />
      </div>

      {isError && (
        <LoadError
          message="No se pudo cargar el Pipeline. Reintenta en unos segundos."
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
                Ningún prospecto coincide con {activeFilterLabels.join(' · ')}
              </p>
              <p className="max-w-md text-sm text-ink-3">
                Cambia ese filtro o quítalo con «Quitar filtros» para volver a ver el tablero
                completo.
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-ink">Aún no hay prospectos abiertos</p>
              <p className="max-w-md text-sm text-ink-3">
                Da de alta el primero con «Nuevo prospecto»: el ciclo arranca en Gris.
              </p>
            </>
          )}
        </div>
      )}

      {board && board.items.length > 0 && (
        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {PIPELINE_COLUMNS.map((status) => (
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
