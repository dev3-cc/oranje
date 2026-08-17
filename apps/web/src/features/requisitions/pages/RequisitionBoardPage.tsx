import { useState, type ReactNode } from 'react'

import { useGetRequisitionBoardQuery } from '../api/requisitionsApi'
import { NewRequisitionDialog } from '../components/NewRequisitionDialog'
import { RequisitionTable } from '../components/RequisitionTable'

import { Button } from '@/shared/components/Button'
import { MetricCard } from '@/shared/components/MetricCard'

/**
 * Tablero de Requisiciones del supervisor.
 *
 * Las cifras del encabezado vienen del backend y NO se derivan de las filas: el
 * tablero muestra una página, pero «8 abiertas en 4 hoteles» habla de todo el
 * territorio. Calcularlas aquí daría números que cambian al paginar.
 */
export function RequisitionBoardPage(): ReactNode {
  const [isNewOpen, setIsNewOpen] = useState(false)

  const { data: board, isLoading, isError } = useGetRequisitionBoardQuery()

  const metrics = board?.metrics

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Ruta" className="flex items-center gap-2 text-sm text-ink-3">
        <span>Demanda</span>
        <span aria-hidden>/</span>
        <span className="font-semibold text-ink-2">Tablero de Requisiciones</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Requisiciones</h1>
          <p className="mt-1.5 text-sm text-ink-3">
            {isLoading || !metrics
              ? 'Cargando requisiciones…'
              : `${metrics.openCount} abiertas · ${metrics.awaitingAuthorization} esperan autorización · ${metrics.urgentCount} urgentes`}
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setIsNewOpen(true)
          }}
        >
          Nueva requisición
        </Button>
      </header>

      {isError && (
        <p className="rounded-lg border border-line bg-surface p-6 text-sm text-red">
          No se pudo cargar el tablero. Reintenta en unos segundos.
        </p>
      )}

      {metrics && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon="assignment"
            value={String(metrics.openCount)}
            label="Abiertas"
            foot={`en ${String(metrics.openHotels)} hoteles`}
          />
          {/* La única métrica que lleva a algún lado: es la que se resuelve firmando. */}
          <MetricCard
            icon="pending_actions"
            value={String(metrics.awaitingAuthorization)}
            label="Por autorizar"
            foot={`${String(metrics.awaitingOver48h)} con más de 48 h`}
            to="/requisiciones/autorizacion"
          />
          <MetricCard
            icon="donut_small"
            value={String(metrics.partialCoverage)}
            label="Cobertura parcial"
            foot={`${String(metrics.freeSlots)} slots libres`}
          />
          <MetricCard
            icon="bolt"
            tone="danger"
            value={String(metrics.urgentCount)}
            label="Urgentes < 72 h"
            foot={metrics.urgentRuleId}
          />
        </div>
      )}

      {board && <RequisitionTable items={board.items} />}

      <NewRequisitionDialog
        isOpen={isNewOpen}
        onClose={() => {
          setIsNewOpen(false)
        }}
      />
    </div>
  )
}
