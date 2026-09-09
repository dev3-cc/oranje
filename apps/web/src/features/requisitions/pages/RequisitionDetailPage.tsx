import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
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
import personajeManager from '@/assets/ilustrations/personaje-manager.svg'
import personajeTalento from '@/assets/ilustrations/personaje-talento.svg'
import { Button, buttonClass } from '@/shared/components/Button'
import { DetailSkeleton } from '@/shared/components/DetailSkeleton'
import { HotelPhotoBackdrop } from '@/shared/components/HotelPhotoBackdrop'
import { NoticeCard } from '@/shared/components/NoticeCard'
import {
  REQUISITION_STATUS_LABEL,
  REQUISITION_STATUS_TOKEN,
} from '@/shared/constants/requisitionStatus'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatDateTime } from '@/shared/lib/formatters'

/** El `i18n` viene del componente (`useLingui`): así el mensaje habla el idioma activo (D-36). */
function deleteErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    byCode: {
      NOT_YOUR_DRAFT: i18n._(
        msg`Este borrador no es tuyo: lo elimina quien lo creó o el Manager General.`,
      ),
      TRANSITION_NOT_ALLOWED: i18n._(
        msg`Una requisición en este estado no se elimina: las cubiertas se conservan como historia.`,
      ),
      REASON_REQUIRED: i18n._(msg`Escribe el motivo: queda en el journal.`),
      REQUISITION_ALREADY_DELETED: i18n._(msg`Esta requisición ya estaba eliminada.`),
      REQUISITION_HAS_ASSIGNMENTS: i18n._(
        msg`Tiene colaboradores asignados: libera las asignaciones antes de eliminarla.`,
      ),
      DEPARTMENT_OUT_OF_SCOPE: i18n._(
        msg`Esta requisición tiene posiciones de otro departamento: la elimina el Manager General.`,
      ),
      FORBIDDEN: i18n._(
        msg`Una requisición autorizada la elimina el Manager de Área de su departamento o el Manager General.`,
      ),
    },
    fallback: i18n._(msg`No se pudo eliminar la requisición. Inténtalo de nuevo.`),
  })
}

/**
 * Detalle de una requisición: qué se pidió, cómo va la cobertura slot por slot
 * y quién la movió de estado.
 *
 * La posición seleccionada es estado local y no va en la URL: es una lente
 * sobre la misma requisición, no un lugar distinto al que alguien quiera
 * enlazar.
 */
export function RequisitionDetailPage(): ReactNode {
  const { t, i18n } = useLingui()
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
          <Trans>
            No se encontró la requisición: puede que se haya eliminado o que el enlace sea viejo.
          </Trans>
        </p>
        <Link to="/requisiciones" className="text-sm font-semibold text-o-700 hover:underline">
          <Trans>Volver al Tablero de Requisiciones</Trans>
        </Link>
      </div>
    )
  }

  // Si nadie ha elegido, manda la primera: la maqueta abre con sus slots a la
  // vista, no con un hueco esperando un clic.
  const selectedPosition =
    detail.positions.find((position) => position.id === selectedPositionId) ?? detail.positions[0]

  /** De autorizada en adelante el motivo es obligatorio (queda en el journal). */
  const needsReason = detail.status !== 'APPLE_GREEN'
  const requisitionNumber = detail.number

  async function confirmDelete(): Promise<void> {
    setDeleteError(null)
    try {
      await deleteRequisition({
        requisitionId,
        ...(needsReason ? { reason: deleteReason.trim() } : {}),
      }).unwrap()
      toast.success(t`Requisición ${requisitionNumber} eliminada`)
      void navigate('/requisiciones')
    } catch (error) {
      setDeleteArmed(false)
      setDeleteError(deleteErrorMessage(error, i18n))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={t`Ruta`} className="flex items-center gap-2 text-sm text-ink-3">
        <Link to="/requisiciones" className="hover:text-o-700">
          <Trans>Demanda</Trans>
        </Link>
        <span aria-hidden>/</span>
        <span className="font-semibold text-ink-2">
          <Trans>Detalle de Requisición</Trans>
        </span>
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
              <Trans>
                {detail.hotelName} · {detail.department} · creada por {detail.createdByName} el{' '}
                {formatDateTime(detail.createdAt)}
              </Trans>
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
            <Trans>Ver bitácora</Trans>
          </Button>
          {/*
            Eliminar = Morado (encargo 10). El borrador lo quita quien lo
            escribió (los tres roles del hotel tienen el permiso); de
            autorizada en adelante, el Manager de Área (su departamento) o el
            Manager General. Cubierta o ya Morada, no se elimina. Quien no
            tiene la atribución NO ve el botón: no es una condición que pueda
            resolver, es su rol.
          */}
          {detail.status !== 'PURPLE' &&
            detail.status !== 'LIGHT_BLUE' &&
            can('requisitions:delete_empty') &&
            (detail.status === 'APPLE_GREEN' ||
              session?.roleId === 'ROL-H-03' ||
              session?.roleId === 'ROL-H-02') &&
            (!isDeleteArmed || !needsReason) && (
              <Button
                disabled={isDeleting}
                className="text-red"
                onClick={() => {
                  if (!isDeleteArmed) {
                    setDeleteArmed(true)
                    return
                  }
                  void confirmDelete()
                }}
              >
                {isDeleting
                  ? t`Eliminando…`
                  : isDeleteArmed
                    ? t`Sí, eliminar requisición`
                    : t`Eliminar requisición`}
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
                <Trans>Ir a Autorización</Trans>
              </Link>
            ) : null
          ) : detail.totals.occupiedCount < detail.totals.slotCount &&
            detail.status !== 'PURPLE' &&
            can('requisitions:take') ? (
            <Link to="/self-pick" className={buttonClass('primary')}>
              <Trans>Cubrir slots en Self-Pick</Trans>
            </Link>
          ) : null}
        </div>
      </header>

      {/* Quién sigue: el patrón de Autorización. El borrador espera la firma
          del Manager; la autorizada ya está en manos de Reclutamiento. */}
      {detail.status === 'APPLE_GREEN' && !can('requisitions:authorize') && (
        <NoticeCard image={personajeManager} title={t`La firma es del Manager`} role="status">
          <Trans>
            Autorizar es del Manager de Área o del Manager General: cuando firmen, la requisición
            pasa a Autorizada y Reclutamiento la ve en la Bolsa del Self-Pick.
          </Trans>
        </NoticeCard>
      )}
      {(detail.status === 'GREEN' || detail.status === 'YELLOW') && !can('requisitions:take') && (
        <NoticeCard image={personajeTalento} title={t`Ahora sigue Reclutamiento`} role="status">
          <Trans>
            La requisición ya está en la Bolsa del Self-Pick: las Reclutadoras van cubriendo los
            slots y aquí verás la cobertura al día.
          </Trans>
        </NoticeCard>
      )}

      {/* La confirmación vive JUNTO al motivo, no arriba en el header: quien
          escribe el porqué tiene el botón a la mano (proximidad de la acción
          con su campo; la skill pide confirmar lo irreversible en el sitio). */}
      {isDeleteArmed && needsReason && (
        <div
          role="group"
          aria-labelledby="delete-reason-label"
          className="flex flex-col gap-3 rounded-lg border border-yellow bg-yellow/10 p-4"
        >
          <label
            id="delete-reason-label"
            htmlFor="delete-reason"
            className="text-sm font-semibold text-ink"
          >
            <Trans>¿Por qué se elimina? El motivo queda en el journal.</Trans>
          </label>
          <input
            id="delete-reason"
            type="text"
            autoFocus
            value={deleteReason}
            onChange={(event) => {
              setDeleteReason(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && deleteReason.trim().length >= 4 && !isDeleting) {
                event.preventDefault()
                void confirmDelete()
              }
            }}
            placeholder="El hotel canceló el evento de temporada"
            className="w-full rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none"
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="secondary"
              disabled={isDeleting}
              onClick={() => {
                setDeleteArmed(false)
                setDeleteReason('')
                setDeleteError(null)
              }}
            >
              <Trans>Cancelar</Trans>
            </Button>
            <Button
              disabled={isDeleting || deleteReason.trim().length < 4}
              title={
                deleteReason.trim().length < 4
                  ? t`Escribe el motivo (al menos 4 letras) para poder eliminarla`
                  : undefined
              }
              className="text-red"
              onClick={() => {
                void confirmDelete()
              }}
            >
              {isDeleting ? t`Eliminando…` : t`Sí, eliminar requisición`}
            </Button>
          </div>
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
