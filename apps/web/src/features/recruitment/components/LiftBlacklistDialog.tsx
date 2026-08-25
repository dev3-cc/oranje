import { useEffect, useState, type ReactNode } from 'react'

import { useLiftBlacklistMutation } from '../api/blacklistApi'
import type { BlacklistRow } from '../types/blacklist.types'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDayMonth } from '@/shared/lib/formatters'

/** Una pareja etiqueta → valor de la ficha del veto, como en la maqueta. */
function EntryField({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-ink-4">{label}</span>
      <span className="text-right text-sm text-ink-2">{value}</span>
    </div>
  )
}

/**
 * Levantar de Blacklist (maqueta de la Reclutadora). La fila NO se borra: se
 * marca como levantada con quién y por qué, y el colaborador vuelve a BLANCO —
 * reingresa por la validación de la Reclutadora, no directo a disponible.
 * `blacklist:lift` es del Administrador: a otros roles el backend les da 403
 * y la pantalla lo dice.
 */
export function LiftBlacklistDialog({
  row,
  onClose,
}: {
  /** `null` = cerrado. */
  row: BlacklistRow | null
  onClose: () => void
}): ReactNode {
  const [liftReason, setLiftReason] = useState('')
  const [lift, { isLoading, error }] = useLiftBlacklistMutation()

  useEffect(() => {
    setLiftReason('')
  }, [row])

  if (!row) return null

  async function submit(): Promise<void> {
    if (!row || liftReason.trim() === '') return
    try {
      await lift({ workerId: row.workerId, liftReason: liftReason.trim() }).unwrap()
      onClose()
    } catch {
      /* el error queda en `error` y se pinta abajo */
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Levantar de Blacklist"
      description={`coverage.blacklist_entry · la fila no se borra: se marca como levantada`}
      className="max-w-xl"
      footer={
        <>
          <Button onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={liftReason.trim() === '' || isLoading}
            onClick={() => {
              void submit()
            }}
          >
            {isLoading ? 'Levantando…' : 'Levantar el veto'}
          </Button>
        </>
      }
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-semibold text-ink">{row.workerName}</p>
        <StatusLightSoftBadge token="st-negro" label="BLACK · Blacklist" />
      </div>

      <div className="flex flex-col gap-2 rounded-md bg-surface-2 p-4">
        <EntryField label="source" value={row.source} />
        <EntryField label="reason" value={row.reason} />
        <EntryField label="evidence_path" value={row.evidencePath ?? '—'} />
        <EntryField label="entered_by" value={row.enteredByName} />
        <EntryField label="occurred_at" value={formatDayMonth(row.occurredAt)} />
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-ink">
          Motivo del levantamiento <span className="font-normal text-ink-3">(obligatorio)</span>
          {IS_DEV_UI && <code className="text-xs font-normal text-ink-4"> · lift_reason</code>}
        </span>
        <textarea
          value={liftReason}
          onChange={(event) => {
            setLiftReason(event.target.value)
          }}
          rows={3}
          placeholder="P. ej. «Acuerdo con el hotel; reincorporación autorizada por el Manager de Reclutamiento.»"
          className="rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none"
        />
      </label>

      <p className="rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-ink-3">
        Al levantarlo, el colaborador vuelve a <span className="font-semibold">Blanco</span> — no a
        disponible: reingresa por la validación de la Reclutadora.
      </p>

      {error !== undefined && (
        <p role="alert" className="text-sm text-red">
          {apiErrorMessage(error, {
            byStatus: { 403: 'Solo el Administrador levanta un veto (blacklist:lift): pídeselo.' },
            fallback: 'No se pudo levantar el veto.',
          })}
        </p>
      )}
    </Modal>
  )
}
