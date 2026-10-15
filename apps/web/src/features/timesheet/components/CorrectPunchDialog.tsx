import type { I18n, MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Input, Textarea, toast } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import { useCorrectPunchMutation } from '../api/timesheetApi'
import type { TimesheetPunch } from '../types/timesheet.types'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { apiErrorMessage } from '@/shared/lib/apiError'

const PUNCH_TYPE_LABEL: Record<string, MessageDescriptor> = {
  CLOCK_IN: msg`Entrada`,
  LUNCH_OUT: msg`Salida a lunch`,
  LUNCH_IN: msg`Regreso de lunch`,
  CLOCK_OUT: msg`Salida`,
}

function correctPunchErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    byCode: {
      TIMESHEET_APPROVED: i18n._(msg`Las horas ya están aprobadas y no se modifican.`),
      TIMESHEET_ALREADY_SENT: i18n._(
        msg`La semana ya se envió a aprobación: no admite más cambios. Si algo quedó mal, comunícate con Oranje.`,
      ),
      DEPARTMENT_OUT_OF_SCOPE: i18n._(msg`Solo corriges las horas de tu departamento.`),
    },
    fallback: i18n._(msg`No se pudo corregir la marca. Inténtalo de nuevo.`),
  })
}

/**
 * Corregir una marca YA REGISTRADA — distinto de Marca manual, que captura
 * la que falta. Del Manager de Área o General (`timesheet:correct_punch`,
 * Hugo, 2026-10-10): quien la trae ya decidió quién puede verla, aquí no se
 * vuelve a preguntar el permiso.
 */
export function CorrectPunchDialog({
  target,
  workerName,
  onClose,
}: {
  /** `date`: el día de ese ponche (`entry.date`) — la hora sola no basta
      para armar `occurredAt`. */
  target: { punch: TimesheetPunch; date: string } | null
  workerName: string
  onClose: () => void
}): ReactNode {
  const { t, i18n } = useLingui()
  const isOpen = target !== null
  const [correctPunch, { isLoading, isError, error }] = useCorrectPunchMutation()
  /* Mismo respiro que Marca manual (Hugo, 2026-10-09): el diálogo se queda
     abierto, ocupado, hasta que la cuadrícula de atrás se puso al día. */
  const [isSyncing, setIsSyncing] = useState(false)

  const [time, setTime] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!isOpen || !target) return
    setTime(target.punch.serverTime)
    setReason('')
    setIsSyncing(false)
  }, [isOpen, target])

  const typeLabel = target ? PUNCH_TYPE_LABEL[target.punch.type] : undefined

  const canSubmit = time !== '' && reason.trim() !== '' && !isLoading && !isSyncing

  async function submit(): Promise<void> {
    if (!canSubmit || !target) return
    try {
      await correctPunch({
        punchId: target.punch.id,
        occurredAt: new Date(`${target.date}T${time}:00`).toISOString(),
        reason: reason.trim(),
      }).unwrap()
      toast.success(t`Marca corregida`)
      setIsSyncing(true)
      window.setTimeout(() => {
        setIsSyncing(false)
        onClose()
      }, 600)
    } catch {
      return
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t`Corregir marca`}
      description={
        target
          ? t`Para ${workerName} — ${typeLabel ? i18n._(typeLabel) : target.punch.type}. Queda registrado quién corrigió y por qué.`
          : ''
      }
    >
      <div className="flex flex-col gap-4">
        {isError && (
          <p role="alert" className="text-sm text-red">
            {correctPunchErrorMessage(error, i18n)}
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-2">
            <Trans>Hora real</Trans>
          </span>
          <Input
            type="time"
            value={time}
            onChange={(event) => {
              setTime(event.target.value)
            }}
            aria-label={t`Hora real de la marca`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-2">
            <Trans>Motivo de la corrección (obligatorio)</Trans>
          </span>
          <Textarea
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
            }}
            rows={2}
            placeholder={t`Por qué la hora registrada estaba mal`}
            aria-label={t`Motivo de la corrección`}
          />
        </label>

        <div className="flex justify-end gap-3 border-t border-line pt-4">
          <Button variant="secondary" disabled={isSyncing} onClick={onClose}>
            <Trans>Cancelar</Trans>
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={() => {
              void submit()
            }}
          >
            {isSyncing ? t`Actualizando…` : isLoading ? t`Guardando…` : t`Corregir marca`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
