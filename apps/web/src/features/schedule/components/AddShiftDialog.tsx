import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import { useCreateShiftMutation } from '../api/scheduleApi'
import type { ScheduleAssignee } from '../types/schedule.types'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { apiErrorMessage } from '@/shared/lib/apiError'

/** El `i18n` viene del componente (`useLingui`): así el mensaje habla el idioma activo (D-36). */
function addShiftErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    byCode: {
      ASSIGNMENT_NOT_ACTIVE: i18n._(msg`Esa persona ya no tiene una asignación activa aquí.`),
      ASSIGNMENT_OTHER_HOTEL: i18n._(msg`Esa asignación es de otro hotel.`),
      DEPARTMENT_OUT_OF_SCOPE: i18n._(msg`Solo planeas turnos de tu departamento.`),
      SHIFT_TOO_LONG: i18n._(msg`Un turno no puede pasar de 16 horas.`),
    },
    fallback: i18n._(msg`No se pudo agregar el turno. Inténtalo de nuevo.`),
  })
}

/**
 * Agregar turno (Manager de Área o General, `schedule:update`): antes solo se
 * podía por API/Postman — el front no tenía ni botón. Pide a quién (una
 * asignación ACTIVA en la demanda del hotel — sin posición, el contrato no
 * liga la asignación con una posición de forma confiable, ver
 * `ScheduleAssignee`), el día y el horario; el back resuelve o crea la semana.
 */
export function AddShiftDialog({
  isOpen,
  hotelId,
  assignees,
  onClose,
}: {
  isOpen: boolean
  hotelId: string
  assignees: ScheduleAssignee[]
  onClose: () => void
}): ReactNode {
  const { t, i18n } = useLingui()
  const [createShift, { isLoading, isError, error }] = useCreateShiftMutation()

  const [assignmentId, setAssignmentId] = useState('')
  const [workDate, setWorkDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setAssignmentId('')
    setWorkDate('')
    setStartTime('')
    setEndTime('')
  }, [isOpen])

  const canSubmit =
    assignmentId !== '' && workDate !== '' && startTime !== '' && endTime !== '' && !isLoading

  async function submit(): Promise<void> {
    if (!canSubmit) return
    try {
      await createShift({ hotelId, assignmentId, workDate, startTime, endTime }).unwrap()
      toast.success(t`Turno agregado`)
      onClose()
    } catch {
      return
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t`Agregar turno`}>
      <div className="flex flex-col gap-4">
        {isError && (
          <p role="alert" className="text-sm text-red">
            {addShiftErrorMessage(error, i18n)}
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-2">
            <Trans>Quién</Trans>
          </span>
          <Select value={assignmentId} onValueChange={setAssignmentId} disabled={isLoading}>
            <SelectTrigger
              aria-label={t`Quién trabaja el turno`}
              className="w-full"
              disabled={assignees.length === 0}
              title={
                assignees.length === 0
                  ? t`Nadie tiene asignación activa en la demanda de este hotel todavía`
                  : undefined
              }
            >
              <SelectValue placeholder={t`Elige a la persona`} />
            </SelectTrigger>
            <SelectContent>
              {assignees.map((assignee) => (
                <SelectItem key={assignee.assignmentId} value={assignee.assignmentId}>
                  {assignee.workerName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {assignees.length === 0 && (
            <span className="text-xs text-ink-3">
              <Trans>
                Nadie tiene una asignación activa en una requisición autorizada de este hotel.
              </Trans>
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-2">
            <Trans>Día</Trans>
          </span>
          <Input
            type="date"
            value={workDate}
            onChange={(event) => {
              setWorkDate(event.target.value)
            }}
            aria-label={t`Día del turno`}
            disabled={isLoading}
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-2">
              <Trans>Entrada</Trans>
            </span>
            <Input
              type="time"
              value={startTime}
              onChange={(event) => {
                setStartTime(event.target.value)
              }}
              aria-label={t`Hora de entrada`}
              disabled={isLoading}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-2">
              <Trans>Salida</Trans>
            </span>
            <Input
              type="time"
              value={endTime}
              onChange={(event) => {
                setEndTime(event.target.value)
              }}
              aria-label={t`Hora de salida`}
              disabled={isLoading}
            />
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose}>
            <Trans>Cancelar</Trans>
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={() => {
              void submit()
            }}
          >
            {isLoading ? t`Agregando…` : t`Agregar turno`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
