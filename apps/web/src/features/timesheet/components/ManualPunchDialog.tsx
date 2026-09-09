import type { I18n, MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
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
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { apiErrorMessage } from '@/shared/lib/apiError'

const PUNCH_TYPE_LABEL: Record<string, MessageDescriptor> = {
  CLOCK_IN: msg`Entrada`,
  LUNCH_OUT: msg`Salida a lunch`,
  LUNCH_IN: msg`Regreso de lunch`,
  CLOCK_OUT: msg`Salida`,
}

/**
 * La marca manual del Supervisor: cuando el ponche de la persona no ocurrió
 * (rechazo de geocerca, teléfono muerto), se captura a mano CON MOTIVO — la
 * marca queda señalada como manual para siempre, no se disfraza de ponche.
 * El texto se traduce al pintar con `i18n._()` (D-36).
 */
const INTRO_SLIDES: readonly {
  image: string
  title: MessageDescriptor
  text: MessageDescriptor
}[] = [
  {
    image: personajeErrorTecnico,
    title: msg`Cuando el ponche normal no pudo`,
    text: msg`La geocerca rechazó la marca, se acabó la pila o no hubo señal: para eso existe la marca manual.`,
  },
  {
    image: personajeEncuesta,
    title: msg`Queda señalada como manual`,
    text: msg`La marca carga tu motivo y se distingue de las normales en la revisión del día — nada se disfraza.`,
  },
  {
    image: personajeDashboard,
    title: msg`La hora que pongas manda`,
    text: msg`Registras la hora real del hecho, no la de ahora: esa es la que cuenta horas para la nómina.`,
  },
]

/** El `i18n` viene del componente (`useLingui`): así el mensaje habla el idioma activo (D-36). */
function manualPunchErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    byCode: {
      ASSIGNMENT_NOT_FOUND: i18n._(msg`El colaborador ya no tiene asignación en esta requisición.`),
    },
    fallback: i18n._(msg`No se pudo registrar la marca. Inténtalo de nuevo.`),
  })
}

export function ManualPunchDialog({
  row,
  initialDate = null,
  onClose,
}: {
  row: Pick<TimesheetRow, 'requisitionId' | 'workerId' | 'workerName'> | null
  /** Precarga el día cuando se abre desde la Revisión de un día puntual. */
  initialDate?: string | null
  onClose: () => void
}): ReactNode {
  const { t, i18n } = useLingui()
  const isOpen = row !== null
  const [createPunch, { isLoading, isError, error }] = useCreateManualPunchMutation()

  const [workDate, setWorkDate] = useState('')
  const [time, setTime] = useState('')
  const [type, setType] = useState('CLOCK_IN')
  const [reason, setReason] = useState('')

  const { isIntroOpen: showIntro, dismissIntro } = useIntroSeen('manual-punch')

  useEffect(() => {
    if (!isOpen) return
    setWorkDate(initialDate ?? '')
    setTime('')
    setType('CLOCK_IN')
    setReason('')
  }, [isOpen, initialDate])

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
      toast.success(t`Marca manual registrada`)
      onClose()
    } catch {
      return
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t`Marca manual`}
      description={
        row ? t`Para ${row.workerName} — la marca quedará señalada como manual, con tu motivo.` : ''
      }
    >
      {showIntro ? (
        <OnboardingIntro
          slides={INTRO_SLIDES.map((slide) => ({
            image: slide.image,
            title: i18n._(slide.title),
            text: i18n._(slide.text),
          }))}
          startLabel={t`Registrar la marca`}
          onDone={() => {
            dismissIntro()
          }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {isError && (
            <p role="alert" className="text-sm text-red">
              {manualPunchErrorMessage(error, i18n)}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
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
                aria-label={t`Día de la marca`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-2">
                <Trans>Hora</Trans>
              </span>
              <Input
                type="time"
                value={time}
                onChange={(event) => {
                  setTime(event.target.value)
                }}
                aria-label={t`Hora de la marca`}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-2">
              <Trans>Tipo de marca</Trans>
            </span>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger aria-label={t`Tipo de marca`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PUNCH_TYPE_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {i18n._(label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-2">
              <Trans>Motivo (obligatorio)</Trans>
            </span>
            <Textarea
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
              }}
              rows={2}
              placeholder={t`Por qué no existe el ponche: rechazo de ubicación, teléfono sin batería…`}
              aria-label={t`Motivo de la marca manual`}
            />
          </label>

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
              {isLoading ? t`Registrando…` : t`Registrar marca`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
