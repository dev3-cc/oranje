import { cn } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import { useReviewTimesheetDayMutation } from '../api/timesheetApi'
import type { TimesheetEntry } from '../types/timesheet.types'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDayMonth } from '@/shared/lib/formatters'

/**
 * Revisión del día (maqueta del Supervisor): las 4 marcas con su geocerca y
 * sus dos relojes, y la nota obligatoria que resuelve el día. Es el paso del
 * Supervisor de D-09 — revisa y anota; aprobar es de otro rol.
 */
export function ReviewDayDialog({
  entry,
  workerName,
  onClose,
}: {
  /** `null` = cerrado. */
  entry: TimesheetEntry | null
  workerName: string
  onClose: () => void
}): ReactNode {
  const [note, setNote] = useState('')
  const [reviewDay, { isLoading, isError, error: saveError }] = useReviewTimesheetDayMutation()

  useEffect(() => {
    setNote(entry?.reviewNote ?? '')
  }, [entry])

  if (!entry) return null

  async function submit(): Promise<void> {
    if (!entry || note.trim() === '') return
    try {
      await reviewTimesheetDay()
    } catch {
      /* el error queda en `isError` y se pinta abajo */
    }
  }

  async function reviewTimesheetDay(): Promise<void> {
    if (!entry) return
    await reviewDay({ dayId: entry.id, note: note.trim() }).unwrap()
    onClose()
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Revisión del día"
      description={`${workerName} · ${formatDayMonth(entry.date)}${IS_DEV_UI ? ' · operations.timesheet_day' : ''}`}
      className="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose} disabled={isLoading}>
            Cerrar
          </Button>
          <Button
            variant="primary"
            disabled={note.trim() === '' || isLoading}
            onClick={() => {
              void submit()
            }}
          >
            {isLoading
              ? 'Guardando…'
              : entry.hasAnomaly
                ? 'Resolver y marcar revisado'
                : 'Marcar revisado'}
          </Button>
        </>
      }
    >
      {entry.hasAnomaly && (
        <p className="rounded-md bg-yellow/15 px-4 py-3 text-sm text-ink-2">
          El día tiene una anomalía sin resolver
          {IS_DEV_UI && <code className="text-xs text-ink-4"> · has_anomaly = true</code>}: revisa
          las marcas y explica la resolución en la nota.
        </p>
      )}

      <section>
        <h3 className="text-sm font-semibold text-ink">
          Las marcas del día
          {IS_DEV_UI && <span className="font-normal text-ink-4"> · operations.punch_mark</span>}
        </h3>
        {entry.punches.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">
            Sin marcas: el día está registrado como ausencia.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {entry.punches.map((punch) => (
              <li
                key={punch.id}
                className="grid grid-cols-[7rem_1fr_auto_auto] items-center gap-3 rounded-md bg-surface-2 px-3 py-2 text-sm"
              >
                <span className="font-semibold text-ink">{punch.type}</span>
                <span
                  className={cn(
                    'text-xs',
                    punch.insideGeofence === false ? 'font-semibold text-red' : 'text-ink-3',
                  )}
                >
                  {punch.isManual
                    ? `manual: ${punch.manualReason ?? 'sin motivo'}`
                    : punch.insideGeofence === false
                      ? 'fuera de geocerca'
                      : 'dentro'}
                </span>
                <span className="text-xs text-ink-3">device {punch.deviceTime ?? '—'}</span>
                <span className="text-xs text-ink-2">server {punch.serverTime}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-ink">
          Nota de revisión <span className="font-normal text-ink-3">(obligatoria)</span>
          {IS_DEV_UI && <code className="text-xs font-normal text-ink-4"> · review_note</code>}
        </span>
        <textarea
          value={note}
          onChange={(event) => {
            setNote(event.target.value)
          }}
          rows={3}
          placeholder="Qué viste y cómo se resuelve — p. ej. «Salió por el acceso de servicio; el GPS tomó la calle.»"
          className="rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none"
        />
      </label>

      {isError && (
        <p role="alert" className="text-sm text-red">
          {apiErrorMessage(saveError, { fallback: 'No se pudo guardar la revisión.' })}
        </p>
      )}
    </Modal>
  )
}
