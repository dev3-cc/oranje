import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import { useApproveHotelUserMutation, useGetPendingHotelUsersQuery } from '../api/adminApi'

import { Button } from '@/shared/components/Button'
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
  const { data: pending = [], isLoading } = useGetPendingHotelUsersQuery()
  const [approve, { isLoading: isApproving }] = useApproveHotelUserMutation()
  const [busyId, setBusyId] = useState<string | null>(null)

  if (isLoading || pending.length === 0) return null

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
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{row.fullName}</span>
              <span className="block truncate text-xs text-ink-3">
                {row.role.name} · {row.hotel.name}
              </span>
              <span className="block truncate text-xs text-ink-4">
                {row.email} · {formatDateTime(row.createdAt)}
              </span>
            </span>
            <Button
              variant="primary"
              disabled={isApproving && busyId === row.id}
              onClick={(): void => void handleApprove(row.id, row.fullName)}
            >
              {isApproving && busyId === row.id ? t`Aprobando…` : t`Aprobar`}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
