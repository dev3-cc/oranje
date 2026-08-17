import { cn } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { useGetPipelineBoardQuery } from '../api/onboardingApi'
import { PipelineColumn } from '../components/PipelineColumn'
import { ProspectFormDialog } from '../components/ProspectFormDialog'
import { usePipelineFilters } from '../hooks/usePipelineFilters'

import { Button } from '@/shared/components/Button'
import { PIPELINE_COLUMNS } from '@/shared/constants/onboardingStatus'

/** Estilo común de los chips de filtro, para que el que es botón no se distinga. */
const FILTER_CHIP_CLASS =
  'rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink-2 whitespace-nowrap'

export function PipelinePage(): ReactNode {
  const navigate = useNavigate()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const { filters, isStaleOnly, toggleStaleOnly } = usePipelineFilters()
  const { data: board, isLoading, isError } = useGetPipelineBoardQuery(filters)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Pipeline</h1>
          <p className="mt-1 text-sm text-ink-3">
            {isLoading
              ? 'Cargando prospectos…'
              : `${board?.openCount ?? 0} prospectos abiertos · ${board?.zoneCount ?? 0} zonas`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Pendiente: ninguna de las dos pantallas destino está diseñada todavía */}
          <Button disabled title="Pendiente: falta el diseño de la vista tabla">
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
        {/*
          Zona y Dueño se pintan como en el diseño pero no son interactivos: su
          selector (dropdown) no está diseñado. El filtro SÍ viaja al endpoint,
          así que conectarlos es solo ponerles el picker encima.
        */}
        <span className={FILTER_CHIP_CLASS}>Zona: {filters.zone ?? 'todas'}</span>
        <span className={FILTER_CHIP_CLASS}>Dueño: Ana Ruiz</span>
        <button
          type="button"
          onClick={toggleStaleOnly}
          aria-pressed={isStaleOnly}
          className={cn(
            FILTER_CHIP_CLASS,
            'transition-colors hover:bg-surface-2',
            isStaleOnly && 'border-o-500 bg-o-50 font-semibold text-o-700',
          )}
        >
          Sin actividad 7+ días
        </button>
      </div>

      {isError && (
        <p className="rounded-md border border-line bg-surface p-6 text-sm text-red">
          No se pudo cargar el pipeline. Reintenta en unos segundos.
        </p>
      )}

      {isLoading && (
        <div className="flex gap-4">
          {PIPELINE_COLUMNS.slice(0, 4).map((status) => (
            <div
              key={status}
              className="h-64 w-80 shrink-0 animate-pulse rounded-lg bg-surface-3/60"
            />
          ))}
        </div>
      )}

      {board && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_COLUMNS.map((status) => (
            <PipelineColumn
              key={status}
              status={status}
              prospects={board.items.filter((item) => item.status === status)}
            />
          ))}
        </div>
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
    </div>
  )
}
