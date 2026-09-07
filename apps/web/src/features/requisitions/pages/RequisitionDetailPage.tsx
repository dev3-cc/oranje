import { statusLight, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { useDeleteRequisitionMutation, useGetRequisitionQuery } from '../api/requisitionsApi'
import { PositionsTable } from '../components/PositionsTable'
import { RequisitionJournalDialog } from '../components/RequisitionJournalDialog'
import { RequisitionSummaryStrip } from '../components/RequisitionSummaryStrip'
import { SlotList } from '../components/SlotList'
import { StatusHistoryCard } from '../components/StatusHistoryCard'

import { useGetSessionQuery } from '@/app/sessionApi'
import { Button, buttonClass } from '@/shared/components/Button'
import { DetailSkeleton } from '@/shared/components/DetailSkeleton'
import { HotelPhotoBackdrop } from '@/shared/components/HotelPhotoBackdrop'
import {
  REQUISITION_STATUS_LABEL,
  REQUISITION_STATUS_TOKEN,
} from '@/shared/constants/requisitionStatus'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
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
  const navigate = useNavigate()
  const { data: session } = useGetSessionQuery()
  const [deleteRequisition, { isLoading: isDeleting }] = useDeleteRequisitionMutation()
  const [isDeleteArmed, setDeleteArmed] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null)
  const [isJournalOpen, setJournalOpen] = useState(false)
  const can = useCan()

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
        <p className="text-sm text-red">
          No se encontró la requisición: puede que se haya eliminado o que el enlace sea viejo.
        </p>
        <Link to="/requisiciones" className="text-sm font-semibold text-o-700 hover:underline">
          Volver al Tablero de Requisiciones
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

      <header className="flex flex-col gap-4">
        {/* Hero con la foto del hotel (D-34): el mismo cristal oscuro que ya
            usan la tarjeta de la semana del Timesheet y la Revisión del día —
            la identidad de la requisición (folio, estado, de qué hotel es)
            ambienta, y los botones de acción se quedan abajo en la superficie
            clara para no perder contraste sobre la foto. */}
        <div className="relative overflow-hidden rounded-xl">
          <HotelPhotoBackdrop photoUrl={detail.hotelPhotoUrl} />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-ink/50 via-ink/65 to-ink/85"
          />
          <div className="relative flex flex-col gap-1.5 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-white">{detail.number}</h1>
              <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: statusLight[REQUISITION_STATUS_TOKEN[detail.status]] }}
                  aria-hidden
                />
                {REQUISITION_STATUS_LABEL[detail.status]}
              </span>
            </div>
            <p className="text-sm text-white/80">
              {detail.hotelName} · {detail.department} · creada por {detail.createdByName} el{' '}
              {formatDateTime(detail.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setJournalOpen(true)
            }}
          >
            Ver bitácora
          </Button>
          {/*
            Eliminar = Morado (encargo 10). El permiso de borrador lo tienen los
            tres roles del hotel; de autorizada en adelante HOY solo entra el
            Manager General (cuando el back sume al de Área —opción 3—, se
            agrega ROL-H-02 aquí). Cubierta o ya Morada, no se elimina.
          */}
          {detail.status !== 'PURPLE' &&
            detail.status !== 'LIGHT_BLUE' &&
            can('requisitions:delete_empty') &&
            (detail.status === 'APPLE_GREEN' || session?.roleId === 'ROL-H-03') && (
              <Button
                disabled={
                  isDeleting ||
                  (isDeleteArmed &&
                    detail.status !== 'APPLE_GREEN' &&
                    deleteReason.trim().length < 4)
                }
                className="text-red"
                onClick={() => {
                  if (!isDeleteArmed) {
                    setDeleteArmed(true)
                    return
                  }
                  void (async () => {
                    setDeleteError(null)
                    try {
                      await deleteRequisition({
                        requisitionId,
                        ...(detail.status === 'APPLE_GREEN' ? {} : { reason: deleteReason.trim() }),
                      }).unwrap()
                      toast.success(`Requisición ${detail.number} eliminada`)
                      void navigate('/requisiciones')
                    } catch (error) {
                      setDeleteArmed(false)
                      setDeleteError(
                        apiErrorMessage(error, {
                          byCode: {
                            NOT_YOUR_DRAFT:
                              'Este borrador no es tuyo: lo elimina quien lo creó o el Manager General.',
                            REQUISITION_HAS_ASSIGNMENTS:
                              'Tiene colaboradores asignados: libera las asignaciones antes de eliminarla.',
                            FORBIDDEN:
                              'Una requisición autorizada la elimina el Manager de Área de su departamento o el Manager General.',
                          },
                          fallback: 'No se pudo eliminar la requisición. Inténtalo de nuevo.',
                        }),
                      )
                    }
                  })()
                }}
              >
                {isDeleting
                  ? 'Eliminando…'
                  : isDeleteArmed
                    ? 'Sí, eliminar requisición'
                    : 'Eliminar requisición'}
              </Button>
            )}
          {/*
            Sin botón «Cambiar estado»: el semáforo camina por HECHOS (D-23) y
            un botón que jamás se habilita es ruido — aquí va la acción que SÍ
            mueve el estado según dónde esté la requisición.
          */}
          {detail.status === 'APPLE_GREEN' ? (
            can('requisitions:authorize') ? (
              <Link to="/requisiciones/autorizacion" className={buttonClass('primary')}>
                Ir a Autorización
              </Link>
            ) : null
          ) : detail.totals.occupiedCount < detail.totals.slotCount &&
            detail.status !== 'PURPLE' &&
            can('requisitions:take') ? (
            <Link to="/self-pick" className={buttonClass('primary')}>
              Cubrir slots en Self-Pick
            </Link>
          ) : null}
        </div>
      </header>

      {isDeleteArmed && detail.status !== 'APPLE_GREEN' && (
        <div className="flex flex-col gap-2 rounded-lg border border-yellow bg-yellow/10 p-4">
          <label htmlFor="delete-reason" className="text-sm font-semibold text-ink">
            ¿Por qué se elimina? El motivo queda en el journal.
          </label>
          <input
            id="delete-reason"
            type="text"
            value={deleteReason}
            onChange={(event) => {
              setDeleteReason(event.target.value)
            }}
            placeholder="El hotel canceló el evento de temporada"
            className="w-full rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none"
          />
        </div>
      )}

      {deleteError !== null && (
        <p role="alert" className="text-sm text-red">
          {deleteError}
        </p>
      )}

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

      {isJournalOpen && (
        <RequisitionJournalDialog
          requisitionId={requisitionId}
          onClose={() => {
            setJournalOpen(false)
          }}
        />
      )}
    </div>
  )
}
