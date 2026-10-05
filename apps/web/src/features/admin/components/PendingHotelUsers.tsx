import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import {
  useApproveHotelUserMutation,
  useGetPendingHotelUsersQuery,
  useRejectHotelUserMutation,
} from '../api/adminApi'

import { Button } from '@/shared/components/Button'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatDateTime } from '@/shared/lib/formatters'

/**
 * Lo que el hotel propuso y espera el visto bueno del Administrador.
 *
 * Los gerentes de hotel rotan y el nuevo no hereda el correo del anterior, así
 * que ahora el hotel puede invitar a su reemplazo sin llamar a Oranje; pero
 * las dos cuentas gerenciales las confirma el Administrador (Hugo,
 * 2026-09-30). El hotel propone, Oranje confirma.
 *
 * La sección **desaparece cuando no hay nada que aprobar**: una lista vacía
 * permanente enseña a ignorar el sitio donde luego aparece lo urgente.
 */
export function PendingHotelUsers(): ReactNode {
  const { t } = useLingui()
  const can = useCan()
  const { data: pending = [], isLoading } = useGetPendingHotelUsersQuery(undefined, {
    skip: !can('users:approve_hotel'),
  })
  const [approve, { isLoading: isApproving }] = useApproveHotelUserMutation()
  const [reject, { isLoading: isRejecting }] = useRejectHotelUserMutation()
  const [busyId, setBusyId] = useState<string | null>(null)
  /** El motivo se abre sobre la misma fila, mismo patrón que rechazar un
      documento del expediente: un clic lo abre, otro confirma. */
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  /* El Administrador y el BDC; a quien no puede aprobar, la consulta le
     daría 403 y la sección no tendría sentido. */
  if (!can('users:approve_hotel') || isLoading || pending.length === 0) return null

  async function handleApprove(id: string, fullName: string): Promise<void> {
    setBusyId(id)
    try {
      await approve(id).unwrap()
      /* Se dice lo que PASA al aprobar, no un «listo»: la invitación sale
         justo ahora, no antes, y quien aprueba debe saberlo. */
      toast.success(t`${fullName} queda activo y le llega su invitación`)
    } catch (error) {
      toast.error(apiErrorMessage(error, { fallback: t`No se pudo aprobar. Inténtalo de nuevo.` }))
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(id: string, fullName: string): Promise<void> {
    if (rejectReason.trim().length < 4) return
    setBusyId(id)
    try {
      await reject({ id, reason: rejectReason.trim() }).unwrap()
      /* Se avisa a quien la propuso con el motivo; aquí basta decir que ya
         no está. */
      toast.success(t`${fullName} queda sin aprobar; se avisó a quien la propuso`)
      setRejectingId(null)
      setRejectReason('')
    } catch (error) {
      toast.error(
        apiErrorMessage(error, {
          byCode: { ALREADY_APPROVED: t`Ya se aprobó: un rechazo no deshace una aprobación.` },
          fallback: t`No se pudo rechazar. Inténtalo de nuevo.`,
        }),
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="rounded-[18px] border border-o-500/40 bg-o-50 p-5">
      <header className="flex items-center gap-2">
        <MaterialIcon name="how_to_reg" className="text-o-700" />
        <h2 className="text-base font-semibold text-ink">
          <Trans>Cuentas por aprobar</Trans>
        </h2>
      </header>
      <p className="mt-1 mb-4 text-sm text-ink-3">
        <Trans>
          Su hotel los propuso. Al aprobar, la cuenta se activa y les llega la invitación; hasta
          entonces no pueden entrar.
        </Trans>
      </p>

      <ul className="flex flex-col gap-2">
        {pending.map((row) => (
          <li
            key={row.id}
            className="flex flex-col gap-2 rounded-xl border border-line bg-surface px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">
                  {row.fullName}
                </span>
                <span className="block truncate text-xs text-ink-3">
                  {row.role.name} · {row.hotel.name}
                </span>
                <span className="block truncate text-xs text-ink-4">
                  {row.email} · {formatDateTime(row.createdAt)}
                </span>
              </span>
              <Button
                variant="secondary"
                className="text-red"
                title={t`La cuenta se borra: el hotel tendría que proponerla de nuevo.`}
                onClick={() => {
                  setRejectingId(row.id)
                  setRejectReason('')
                }}
              >
                <Trans>Rechazar</Trans>
              </Button>
              <Button
                variant="primary"
                disabled={isApproving && busyId === row.id}
                onClick={(): void => void handleApprove(row.id, row.fullName)}
              >
                {isApproving && busyId === row.id ? t`Aprobando…` : t`Aprobar`}
              </Button>
            </div>
            {rejectingId === row.id && (
              <div className="flex flex-wrap items-center gap-2 rounded-md bg-red/10 p-2">
                <input
                  type="text"
                  autoFocus
                  value={rejectReason}
                  onChange={(event) => {
                    setRejectReason(event.target.value)
                  }}
                  placeholder={t`¿Por qué se rechaza?`}
                  aria-label={t`Motivo del rechazo`}
                  className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-o-500 focus:outline-none"
                />
                <Button
                  variant="secondary"
                  className="px-3 py-1 text-xs"
                  onClick={() => {
                    setRejectingId(null)
                  }}
                >
                  <Trans>Cancelar</Trans>
                </Button>
                <Button
                  variant="primary"
                  className="px-3 py-1 text-xs"
                  disabled={rejectReason.trim().length < 4 || (isRejecting && busyId === row.id)}
                  onClick={(): void => void handleReject(row.id, row.fullName)}
                >
                  <Trans>Confirmar rechazo</Trans>
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
