import { Trans, useLingui } from '@lingui/react/macro'
import { Input, MaterialIcon, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import {
  useApprovePayAdjustmentMutation,
  useGetPendingPayAdjustmentsQuery,
  useRejectPayAdjustmentMutation,
  type PayAdjustment,
} from '@/features/recruitment'
import { Button } from '@/shared/components/Button'
import { LoadError } from '@/shared/components/LoadError'
import { Modal } from '@/shared/components/Modal'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatDateTime, formatMoney } from '@/shared/lib/formatters'

/**
 * La cola del Observador (Hugo, 2026-10-08): el ajuste de tarifa o el gasto
 * extra (p. ej. «Uber») de una asignación eventual, pedido por Reclutamiento
 * — única acción de escritura que tiene este rol, por lo demás de puro
 * lectura. Mientras un ajuste está aquí, no pesa en ningún cálculo de pago.
 */
export function PayAdjustmentsQueuePage(): ReactNode {
  const { t } = useLingui()
  /* Al aterrizar siempre refresca (mismo criterio que la Bolsa Self-Pick):
     esta cola es para decidir sobre dinero AHORA, nunca una lista que pudo
     quedar vieja desde la última visita. */
  const {
    data: pending = [],
    isLoading,
    isError,
    refetch,
  } = useGetPendingPayAdjustmentsQuery(undefined, { refetchOnMountOrArgChange: true })
  const [rejecting, setRejecting] = useState<PayAdjustment | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          <Trans>Ajustes pendientes</Trans>
        </h1>
        <p className="mt-1.5 text-sm text-ink-3">
          <Trans>
            El ajuste de tarifa o el gasto extra (p. ej. Uber) de una asignación eventual. Mientras
            esté aquí, no pesa en ningún pago.
          </Trans>
        </p>
      </header>

      {isError && (
        <LoadError
          message={t`No se pudieron cargar los ajustes pendientes. Reintenta en unos segundos.`}
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading ? (
        <TableSkeleton rows={4} columns={5} />
      ) : pending.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
          <Trans>Sin ajustes pendientes: nada que aprobar por ahora.</Trans>
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((row) => (
            <PendingAdjustmentCard
              key={row.id}
              row={row}
              onReject={() => {
                setRejecting(row)
              }}
            />
          ))}
        </ul>
      )}

      {rejecting !== null && (
        <RejectAdjustmentDialog
          target={rejecting}
          onClose={() => {
            setRejecting(null)
          }}
        />
      )}
    </div>
  )
}

function PendingAdjustmentCard({
  row,
  onReject,
}: {
  row: PayAdjustment
  onReject: () => void
}): ReactNode {
  const { t } = useLingui()
  const [approve, { isLoading: isApproving }] = useApprovePayAdjustmentMutation()
  const [error, setError] = useState<string | null>(null)

  async function confirmApprove(): Promise<void> {
    setError(null)
    try {
      await approve({ id: row.id }).unwrap()
      toast.success(t`Ajuste aprobado`)
    } catch (approveError) {
      setError(
        apiErrorMessage(approveError, {
          fallback: t`No se pudo aprobar. Inténtalo de nuevo.`,
        }),
      )
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">
          {row.worker.fullName} · {row.hotelName}
        </p>
        <p className="text-xs text-ink-3">{row.requisitionNumber}</p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-2">
          <MaterialIcon name="payments" className="text-base text-ink-4" aria-hidden />
          <span className="font-semibold text-ink">{formatMoney(Number(row.amount))}</span>
          <span className="text-ink-3">
            {row.payConcept ? (
              <Trans>· gasto: {row.payConcept.name}</Trans>
            ) : (
              <Trans>· ajuste a la tarifa de la posición</Trans>
            )}
          </span>
        </p>
        <p className="mt-1 text-sm text-ink-3">«{row.reason}»</p>
        <p className="mt-1 text-xs text-ink-4">
          <Trans>
            Pedido por {row.requestedBy.fullName} · {formatDateTime(row.requestedAt)}
          </Trans>
        </p>
        {error !== null && (
          <p role="alert" className="mt-2 text-xs text-red">
            {error}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 self-start">
        <Button onClick={onReject} disabled={isApproving}>
          <Trans>Rechazar</Trans>
        </Button>
        <Button
          variant="primary"
          disabled={isApproving}
          onClick={() => {
            void confirmApprove()
          }}
        >
          {isApproving ? <Trans>Aprobando…</Trans> : <Trans>Aprobar</Trans>}
        </Button>
      </div>
    </li>
  )
}

function RejectAdjustmentDialog({
  target,
  onClose,
}: {
  target: PayAdjustment
  onClose: () => void
}): ReactNode {
  const { t } = useLingui()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reject, { isLoading }] = useRejectPayAdjustmentMutation()

  async function confirm(): Promise<void> {
    if (reason.trim().length < 4) return
    setError(null)
    try {
      await reject({ id: target.id, reason: reason.trim() }).unwrap()
      toast.success(t`Ajuste rechazado`)
      onClose()
    } catch (rejectError) {
      setError(
        apiErrorMessage(rejectError, {
          fallback: t`No se pudo rechazar. Inténtalo de nuevo.`,
        }),
      )
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t`Rechazar ajuste`}
      footer={
        <>
          <Button onClick={onClose} disabled={isLoading}>
            <Trans>Cancelar</Trans>
          </Button>
          <Button
            variant="primary"
            disabled={reason.trim().length < 4 || isLoading}
            onClick={() => {
              void confirm()
            }}
          >
            {isLoading ? <Trans>Rechazando…</Trans> : <Trans>Sí, rechazar</Trans>}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-2">
        <Trans>
          {target.worker.fullName} · {formatMoney(Number(target.amount))} — el motivo queda
          registrado y Reclutamiento lo ve.
        </Trans>
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink-2">
          <Trans>Motivo</Trans>
        </span>
        <Input
          value={reason}
          onChange={(event) => {
            setReason(event.target.value)
          }}
          placeholder={t`Por qué no procede…`}
          aria-label={t`Motivo del rechazo`}
        />
      </label>
      {error !== null && (
        <p role="alert" className="rounded-md bg-red/10 px-3 py-2 text-sm text-red">
          {error}
        </p>
      )}
    </Modal>
  )
}
