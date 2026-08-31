import { Alert, AlertDescription, cn } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import { useReviewTimesheetDayMutation } from '../api/timesheetApi'
import type { TimesheetEntry } from '../types/timesheet.types'

import personajeAyuda from '@/assets/ilustrations/personaje-ayuda.svg'
import personajeCronograma from '@/assets/ilustrations/personaje-cronograma.svg'
import personajePago from '@/assets/ilustrations/personaje-pago-procesado.svg'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDayMonth } from '@/shared/lib/formatters'

const PUNCH_TYPE_LABEL: Record<string, string> = {
  CLOCK_IN: 'Entrada',
  LUNCH_OUT: 'Salida a lunch',
  LUNCH_IN: 'Regreso de lunch',
  CLOCK_OUT: 'Salida',
}

const INTRO_SLIDES = [
  {
    image: personajeCronograma,
    title: 'El día completo, marca por marca',
    text: 'Entrada, lunch y salida con su geocerca y sus dos relojes. Un día sin salida no puede irse a revisión.',
  },
  {
    image: personajeAyuda,
    title: 'Revisar no es aprobar',
    text: 'Tú resuelves anomalías y dejas la nota; aprobar las horas es del Manager de Área o del General.',
  },
  {
    image: personajePago,
    title: 'Solo lo aprobado paga',
    text: 'Lo que no llegue aprobado al cierre semanal queda en espera: sin pago y sin factura hasta que alguien apruebe.',
  },
] as const

export function ReviewDayDialog({
  entry,
  workerName,
  onClose,
}: {
  entry: TimesheetEntry | null
  workerName: string
  onClose: () => void
}): ReactNode {
  const [note, setNote] = useState('')
  const [reviewDay, { isLoading, isError, error: saveError }] = useReviewTimesheetDayMutation()
  const [showIntro, setShowIntro] = useState(false)

  useEffect(() => {
    setNote(entry?.reviewNote ?? '')
    if (entry) setShowIntro(true)
  }, [entry])

  if (!entry) return null

  async function submit(): Promise<void> {
    if (!entry || note.trim() === '') return
    try {
      await reviewTimesheetDay()
    } catch {
      return
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
        showIntro ? null : (
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
        )
      }
    >
      {showIntro ? (
        <OnboardingIntro
          slides={INTRO_SLIDES}
          startLabel="Revisar el día"
          onDone={() => {
            setShowIntro(false)
          }}
        />
      ) : (
        <>
          {entry.hasAnomaly && (
            <p className="rounded-md bg-yellow/15 px-4 py-3 text-sm text-ink-2">
              El día tiene una anomalía sin resolver
              {IS_DEV_UI && <code className="text-xs text-ink-4"> · has_anomaly = true</code>}:
              revisa las marcas y explica la resolución en la nota.
            </p>
          )}

          <section>
            <h3 className="text-sm font-semibold text-ink">
              Las marcas del día
              {IS_DEV_UI && (
                <span className="font-normal text-ink-4"> · operations.punch_mark</span>
              )}
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
                    <span className="font-semibold text-ink">
                      {PUNCH_TYPE_LABEL[punch.type] ?? punch.type}
                    </span>
                    <span
                      className={cn(
                        'text-xs',
                        punch.insideGeofence === false ? 'font-semibold text-red' : 'text-ink-3',
                      )}
                    >
                      {punch.isManual
                        ? `Manual · ${punch.manualReason ?? 'sin motivo'}`
                        : punch.insideGeofence === false
                          ? 'fuera de geocerca'
                          : 'dentro de la geocerca'}
                    </span>
                    <span className="text-xs text-ink-3">teléfono {punch.deviceTime ?? '—'}</span>
                    <span className="text-xs text-ink-2">servidor {punch.serverTime}</span>
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
            <Alert variant="destructive">
              <AlertDescription>
                {apiErrorMessage(saveError, {
                  fallback: 'No se pudo guardar la revisión. Inténtalo de nuevo.',
                })}
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </Modal>
  )
}
