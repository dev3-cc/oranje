import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import { useGetRequisitionQuery } from '../api/requisitionsApi'
import { PositionsTable } from '../components/PositionsTable'
import { RequisitionSummaryStrip } from '../components/RequisitionSummaryStrip'
import { SlotList } from '../components/SlotList'
import { StatusHistoryCard } from '../components/StatusHistoryCard'

import { Button, buttonClass } from '@/shared/components/Button'
import { DetailSkeleton } from '@/shared/components/DetailSkeleton'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
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
    return <DetailSkeleton />
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
            <StatusLightSoftBadge
              token={REQUISITION_STATUS_TOKEN[detail.status]}
              label={REQUISITION_STATUS_LABEL[detail.status]}
            />
          </div>
          <p className="mt-1.5 text-sm text-ink-3">
            {detail.hotelName} · {detail.department} · creada por {detail.createdByName} el{' '}
            {formatDateTime(detail.createdAt)}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {/* Espera maqueta; se deja visible para no mover el encabezado después. */}
          <Button variant="secondary" disabled title="Pendiente: falta el diseño de la bitácora">
            Ver bitácora
          </Button>
          {/*
            Sin botón «Cambiar estado»: el semáforo camina por HECHOS (D-23) y
            un botón que jamás se habilita es ruido — aquí va la acción que SÍ
            mueve el estado según dónde esté la requisición.
          */}
          {detail.status === 'APPLE_GREEN' ? (
            <Link to="/requisiciones/autorizacion" className={buttonClass('primary')}>
              Ir a Autorización
            </Link>
          ) : detail.totals.occupiedCount < detail.totals.slotCount &&
            detail.status !== 'PURPLE' ? (
            <Link to="/self-pick" className={buttonClass('primary')}>
              Cubrir slots en Self-Pick
            </Link>
          ) : null}
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
