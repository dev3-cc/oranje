import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import { useGetRequisitionQuery } from '../api/requisitionsApi'
import { PositionsTable } from '../components/PositionsTable'
import { RequisitionSummaryStrip } from '../components/RequisitionSummaryStrip'
import { SlotList } from '../components/SlotList'
import { StatusHistoryCard } from '../components/StatusHistoryCard'

import { Button } from '@/shared/components/Button'
import { SemaforoSoftBadge } from '@/shared/components/SemaforoSoftBadge'
import {
  REQUISITION_STATUS_LABEL,
  REQUISITION_STATUS_TOKEN,
} from '@/shared/constants/requisitionStatus'
import { formatDateTime } from '@/shared/lib/formatters'

/**
 * Detalle de una requisición: qué se pidió, cómo va la cobertura slot por slot
 * y quién la movió de estado.
 *
 * La posición seleccionada es estado local y no va en la URL: es una lente
 * sobre la misma requisición, no un lugar distinto al que alguien quiera
 * enlazar.
 */
export function RequisitionDetailPage(): ReactNode {
  const { requisitionId = '' } = useParams()
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null)

  const {
    data: detail,
    isLoading,
    isError,
  } = useGetRequisitionQuery(requisitionId, { skip: requisitionId === '' })

  if (isLoading) {
    return <p className="text-sm text-ink-3">Cargando requisición…</p>
  }

  if (isError || !detail) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-6">
        <p className="text-sm text-red">No se encontró la requisición.</p>
        <Link to="/requisiciones" className="text-sm font-semibold text-o-700 hover:underline">
          Volver al tablero
        </Link>
      </div>
    )
  }

  // Si nadie ha elegido, manda la primera: la maqueta abre con sus slots a la
  // vista, no con un hueco esperando un clic.
  const selectedPosition =
    detail.positions.find((position) => position.id === selectedPositionId) ?? detail.positions[0]

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Ruta" className="flex items-center gap-2 text-sm text-ink-3">
        <Link to="/requisiciones" className="hover:text-o-700">
          Demanda
        </Link>
        <span aria-hidden>/</span>
        <span className="font-semibold text-ink-2">Detalle de Requisición</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-ink">{detail.number}</h1>
            <SemaforoSoftBadge
              token={REQUISITION_STATUS_TOKEN[detail.status]}
              label={REQUISITION_STATUS_LABEL[detail.status]}
            />
          </div>
          <p className="mt-1.5 text-sm text-ink-3">
            {detail.hotelName} · {detail.department} · creada por {detail.createdByName} el{' '}
            {formatDateTime(detail.createdAt)}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          {/* Ambas esperan maqueta; se dejan visibles para no mover el encabezado después. */}
          <Button variant="secondary" disabled title="Pendiente: falta el diseño de la bitácora">
            Ver bitácora
          </Button>
          <Button
            variant="primary"
            disabled
            title="Pendiente: falta el diseño del cambio de estado"
          >
            Cambiar estado
          </Button>
        </div>
      </header>

      <RequisitionSummaryStrip detail={detail} />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <PositionsTable
            positions={detail.positions}
            selectedId={selectedPosition?.id ?? ''}
            onSelect={setSelectedPositionId}
          />
          {selectedPosition && <SlotList position={selectedPosition} />}
        </div>

        <StatusHistoryCard history={detail.history} />
      </div>
    </div>
  )
}
