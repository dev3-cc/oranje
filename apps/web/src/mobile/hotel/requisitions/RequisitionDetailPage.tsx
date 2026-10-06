import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { CoverageBar, RequisitionStatusChip, UrgencyChip } from './requisitionParts'
import {
  useAppAuthorizeRequisitionMutation,
  useAppDeleteRequisitionMutation,
  useAppRequisitionQuery,
  type AppRequisitionPosition,
} from './requisitionsAppApi'

import { useAppSelector } from '@/app/hooks'
import { selectSessionUser } from '@/app/sessionSlice'
import { LoadError } from '@/shared/components/LoadError'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatDate, formatDateTime } from '@/shared/lib/formatters'

/** Mismos textos que el web (`AuthorizationResolutionForm`): comparten traducción. */
function authorizeErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    byCode: {
      FORBIDDEN: i18n._(
        msg`Tu rol no autoriza requisiciones: lo hacen el Manager de Área, el Manager General o el Inspector de la zona.`,
      ),
      DEPARTMENT_OUT_OF_SCOPE: i18n._(
        msg`Esta requisición es de otro departamento: la autoriza su Manager de Área o el Manager General.`,
      ),
      HOTEL_OUT_OF_SCOPE: i18n._(msg`Esta requisición no es de tu hotel.`),
      REQUISITION_NOT_DRAFT: i18n._(
        msg`Esta requisición ya no está en Borrador: alguien más ya la autorizó o la cambió de estado.`,
      ),
    },
    fallback: i18n._(msg`No se pudo autorizar la requisición. Inténtalo de nuevo.`),
  })
}

function deleteErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    byCode: {
      NOT_YOUR_DRAFT: i18n._(
        msg`Este borrador no es tuyo: lo elimina quien lo creó o el Manager General.`,
      ),
    },
    fallback: i18n._(msg`No se pudo eliminar la requisición. Inténtalo de nuevo.`),
  })
}

function PositionCard({
  position,
  isClosed,
}: {
  position: AppRequisitionPosition
  /** Cubierta o eliminada: la urgencia ya no dice nada. */
  isClosed: boolean
}): ReactNode {
  const { t } = useLingui()
  const time = position.startTime?.slice(0, 5)
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-ink">{position.name}</p>
          <p className="text-xs text-ink-3">
            {position.department} · {position.modality}
          </p>
        </div>
        {!isClosed && <UrgencyChip urgency={position.urgency} />}
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-ink-3">
            <Trans>Fecha de inicio</Trans>
          </dt>
          <dd className="font-medium text-ink">
            {formatDate(position.startDate)}
            {time ? ` · ${time}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">
            <Trans>Inglés</Trans>
          </dt>
          <dd className="font-medium text-ink">{position.english ?? t`No requerido`}</dd>
        </div>
      </dl>
      <CoverageBar filled={position.filled} total={position.quantity} />
      {position.slots.some((slot) => slot.workerName !== null) && (
        <ul className="flex flex-col gap-1.5 border-t border-line pt-3">
          {position.slots
            .filter((slot) => slot.workerName !== null)
            .map((slot) => (
              <li key={slot.ordinal} className="flex items-center gap-2 text-sm text-ink-2">
                <MaterialIcon name="person" className="text-base text-green" aria-hidden />
                {slot.workerName}
              </li>
            ))}
        </ul>
      )}
    </li>
  )
}

/**
 * El detalle de una requisición en la app, con las acciones que el rol tiene
 * en el web:
 *
 *   Autorizar  En elaboración y `requisitions:authorize` (Manager de Área en
 *              su departamento, Manager General). Pasa a Autorizada.
 *   Eliminar   `requisitions:delete_empty`. El borrador lo quita quien lo
 *              creó; de Autorizada en adelante, el Manager de Área o el
 *              General, con motivo. Cubierta o eliminada, ya no.
 *
 * Quien no tiene la atribución no ve el botón: no es algo que pueda resolver.
 */
export function RequisitionDetailPage(): ReactNode {
  const { t, i18n } = useLingui()
  const { requisitionId = '' } = useParams()
  const navigate = useNavigate()
  const can = useCan()
  const roleId = useAppSelector(selectSessionUser)?.roleId
  const { data: detail, isLoading, error, refetch } = useAppRequisitionQuery(requisitionId)
  const [authorize, { isLoading: isAuthorizing }] = useAppAuthorizeRequisitionMutation()
  const [remove, { isLoading: isDeleting }] = useAppDeleteRequisitionMutation()
  const [confirming, setConfirming] = useState<'authorize' | 'delete' | null>(null)
  const [reason, setReason] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const back = (
    <Link
      to="/hotel/requisitions"
      className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-o-700"
    >
      <MaterialIcon name="arrow_back" className="text-lg" aria-hidden />
      <Trans>Requisiciones</Trans>
    </Link>
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy aria-label={t`Cargando`}>
        {back}
        <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
        <div className="h-48 animate-pulse rounded-2xl bg-surface-2" />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <LoadError
          message={apiErrorMessage(error, { fallback: t`No se pudo cargar la requisición.` })}
          onRetry={() => {
            void refetch()
          }}
        />
      </div>
    )
  }

  const canAuthorize = detail.status === 'APPLE_GREEN' && can('requisitions:authorize')
  const canDelete =
    detail.status !== 'PURPLE' &&
    detail.status !== 'LIGHT_BLUE' &&
    can('requisitions:delete_empty') &&
    (detail.status === 'APPLE_GREEN' || roleId === 'ROL-H-03' || roleId === 'ROL-H-02')
  const needsReason = detail.status !== 'APPLE_GREEN'
  const requisitionNumber = detail.number

  async function onAuthorize(): Promise<void> {
    setActionError(null)
    try {
      await authorize(requisitionId).unwrap()
      toast.success(t`Requisición ${requisitionNumber} autorizada`)
      setConfirming(null)
    } catch (cause) {
      setActionError(authorizeErrorMessage(cause, i18n))
    }
  }

  async function onDelete(): Promise<void> {
    setActionError(null)
    try {
      await remove({ requisitionId, ...(needsReason ? { reason: reason.trim() } : {}) }).unwrap()
      toast.success(t`Requisición ${requisitionNumber} eliminada`)
      await navigate('/hotel/requisitions')
    } catch (cause) {
      setActionError(deleteErrorMessage(cause, i18n))
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {back}

      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-ink-3">{detail.number}</p>
            <h1 className="text-lg font-bold text-ink">{detail.department}</h1>
          </div>
          <RequisitionStatusChip status={detail.status} />
        </div>
        <CoverageBar filled={detail.filled} total={detail.total} />
        <dl className="grid grid-cols-1 gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-3">
              <Trans>Creada</Trans>
            </dt>
            <dd className="text-right text-ink">
              {detail.createdByName ?? '—'} · {formatDateTime(detail.createdAt)}
            </dd>
          </div>
          {detail.authorizedAt && (
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">
                <Trans>Autorizada</Trans>
              </dt>
              <dd className="text-right text-ink">
                {detail.authorizedByName ?? '—'} · {formatDateTime(detail.authorizedAt)}
              </dd>
            </div>
          )}
          {detail.inspectorName && (
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">
                <Trans>Inspector</Trans>
              </dt>
              <dd className="text-right text-ink">{detail.inspectorName}</dd>
            </div>
          )}
        </dl>
      </section>

      {detail.status === 'APPLE_GREEN' && !canAuthorize && (
        <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink-2" role="status">
          <Trans>
            Autorizar es del Manager de Área o del Manager General: cuando firmen, la requisición
            pasa a Autorizada y Reclutamiento la ve en la Bolsa del Self-Pick.
          </Trans>
        </p>
      )}

      <h2 className="text-sm font-semibold text-ink-2">
        <Trans>Posiciones</Trans> · {detail.positions.length}
      </h2>
      <ul className="flex flex-col gap-3">
        {detail.positions.map((position) => (
          <PositionCard
            key={position.id}
            position={position}
            isClosed={detail.status === 'LIGHT_BLUE' || detail.status === 'PURPLE'}
          />
        ))}
      </ul>

      {actionError && (
        <p role="alert" className="rounded-xl bg-red/10 p-3 text-sm text-red">
          {actionError}
        </p>
      )}

      {(canAuthorize || canDelete) && (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          {confirming === 'authorize' ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-green/40 bg-green/10 p-4">
              <p className="text-sm text-ink">
                <Trans>
                  Al autorizarla pasa a Autorizada y Reclutamiento empieza a cubrirla. ¿Seguro?
                </Trans>
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isAuthorizing}
                  onClick={() => {
                    void onAuthorize()
                  }}
                  className="min-h-12 flex-1 rounded-xl bg-o-300 px-4 text-sm font-semibold text-ink active:bg-o-400 disabled:opacity-60"
                >
                  {isAuthorizing ? t`Autorizando…` : t`Sí, autorizar`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(null)
                  }}
                  className="min-h-12 rounded-xl border border-line px-4 text-sm font-semibold text-ink-2"
                >
                  <Trans>Cancelar</Trans>
                </button>
              </div>
            </div>
          ) : confirming === 'delete' ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-red/30 bg-red/5 p-4">
              {needsReason ? (
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                  <Trans>¿Por qué se elimina? El motivo queda en el journal.</Trans>
                  <textarea
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value)
                    }}
                    rows={3}
                    className="rounded-xl border border-line bg-surface p-3 text-sm font-normal text-ink"
                  />
                </label>
              ) : (
                <p className="text-sm text-ink">
                  <Trans>Se elimina el borrador y no se puede recuperar. ¿Seguro?</Trans>
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isDeleting || (needsReason && reason.trim().length === 0)}
                  onClick={() => {
                    void onDelete()
                  }}
                  className="min-h-12 flex-1 rounded-xl bg-red px-4 text-sm font-semibold text-surface disabled:opacity-50"
                >
                  {isDeleting ? t`Eliminando…` : t`Sí, eliminar requisición`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(null)
                  }}
                  className="min-h-12 rounded-xl border border-line px-4 text-sm font-semibold text-ink-2"
                >
                  <Trans>Cancelar</Trans>
                </button>
              </div>
            </div>
          ) : (
            <>
              {canAuthorize && (
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null)
                    setConfirming('authorize')
                  }}
                  className="min-h-12 rounded-xl bg-o-300 px-4 text-sm font-semibold text-ink shadow-xs active:bg-o-400"
                >
                  <Trans>Autorizar requisición</Trans>
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null)
                    setConfirming('delete')
                  }}
                  className="min-h-12 rounded-xl border border-line px-4 text-sm font-semibold text-red"
                >
                  <Trans>Eliminar requisición</Trans>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
