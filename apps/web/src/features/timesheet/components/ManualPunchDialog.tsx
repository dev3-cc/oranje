import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import { useCreateManualPunchMutation } from '../api/timesheetApi'
import type { TimesheetRow } from '../types/timesheet.types'

import personajeDashboard from '@/assets/ilustrations/personaje-dashboard.svg'
import personajeEncuesta from '@/assets/ilustrations/personaje-encuesta.svg'
import personajeErrorTecnico from '@/assets/ilustrations/personaje-error-tecnico.svg'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { apiErrorMessage } from '@/shared/lib/apiError'

const PUNCH_TYPE_LABEL: Record<string, string> = {
  CLOCK_IN: 'Entrada',
  LUNCH_OUT: 'Salida a lunch',
  LUNCH_IN: 'Regreso de lunch',
  CLOCK_OUT: 'Salida',
}

/**
 * La marca manual del Supervisor: cuando el ponche de la persona no ocurrió
 * (rechazo de geocerca, teléfono muerto), se captura a mano CON MOTIVO — la
 * marca queda señalada como manual para siempre, no se disfraza de ponche.
 */
const INTRO_SLIDES = [
  {
    image: personajeErrorTecnico,
    title: 'Cuando el ponche normal no pudo',
    text: 'La geocerca rechazó la marca, se acabó la pila o no hubo señal: para eso existe la marca manual.',
  },
  {
    image: personajeEncuesta,
    title: 'Queda señalada como manual',
    text: 'La marca carga tu motivo y se distingue de las normales en la revisión del día — nada se disfraza.',
  },
  {
    image: personajeDashboard,
    title: 'La hora que pongas manda',
    text: 'Registras la hora real del hecho, no la de ahora: esa es la que cuenta horas para la nómina.',
  },
] as const

export function ManualPunchDialog({
  row,
  onClose,
}: {
  row: TimesheetRow | null
  onClose: () => void
}): ReactNode {
  const isOpen = row !== null
  const [createPunch, { isLoading, isError, error }] = useCreateManualPunchMutation()

  const [workDate, setWorkDate] = useState('')
  const [time, setTime] = useState('')
  const [type, setType] = useState('CLOCK_IN')
  const [reason, setReason] = useState('')

  const [showIntro, setShowIntro] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setShowIntro(true)
    setWorkDate('')
    setTime('')
    setType('CLOCK_IN')
    setReason('')
  }, [isOpen])

  const canSubmit = workDate !== '' && time !== '' && reason.trim() !== '' && !isLoading

  async function submit(): Promise<void> {
    if (!canSubmit || !row) return
    try {
      await createPunch({
        requisitionId: row.requisitionId,
        workerId: row.workerId,
        type: type as 'CLOCK_IN' | 'LUNCH_OUT' | 'LUNCH_IN' | 'CLOCK_OUT',
        workDate,
        occurredAt: new Date(`${workDate}T${time}:00`).toISOString(),
        reason: reason.trim(),
      }).unwrap()
      onClose()
    } catch {
      return
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Marca manual"
      description={
        row ? `Para ${row.workerName} — la marca quedará señalada como manual, con tu motivo.` : ''
      }
    >
      {showIntro ? (
        <OnboardingIntro
          slides={INTRO_SLIDES}
          startLabel="Registrar la marca"
          onDone={() => {
            setShowIntro(false)
          }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {isError && (
            <p role="alert" className="text-sm text-red">
              {apiErrorMessage(error, {
                byCode: {
                  ASSIGNMENT_NOT_FOUND:
                    'El colaborador ya no tiene asignación en esta requisición.',
                },
                fallback: 'No se pudo registrar la marca. Inténtalo de nuevo.',
              })}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-2">Día</span>
              <Input
                type="date"
                value={workDate}
                onChange={(event) => {
                  setWorkDate(event.target.value)
                }}
                aria-label="Día de la marca"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-2">Hora</span>
              <Input
                type="time"
                value={time}
                onChange={(event) => {
                  setTime(event.target.value)
                }}
                aria-label="Hora de la marca"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-2">Tipo de marca</span>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger aria-label="Tipo de marca" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PUNCH_TYPE_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-2">Motivo (obligatorio)</span>
            <Textarea
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
              }}
              rows={2}
              placeholder="Por qué no existe el ponche: rechazo de ubicación, teléfono sin batería…"
              aria-label="Motivo de la marca manual"
            />
          </label>

          <div className="flex justify-end gap-3 border-t border-line pt-4">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={!canSubmit}
              onClick={() => {
                void submit()
              }}
            >
              {isLoading ? 'Registrando…' : 'Registrar marca'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
