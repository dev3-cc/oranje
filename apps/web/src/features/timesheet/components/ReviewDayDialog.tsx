import { Alert, AlertDescription, MaterialIcon, statusLight, toast } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import { useReviewTimesheetDayMutation } from '../api/timesheetApi'
import type { ReviewContext, TimesheetEntry } from '../types/timesheet.types'

import personajeAyuda from '@/assets/ilustrations/personaje-ayuda.svg'
import personajeCronograma from '@/assets/ilustrations/personaje-cronograma.svg'
import personajePago from '@/assets/ilustrations/personaje-pago-procesado.svg'
import { Button } from '@/shared/components/Button'
import { HotelPhotoBackdrop } from '@/shared/components/HotelPhotoBackdrop'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { TIMESHEET_STATUS_LABEL, TIMESHEET_STATUS_TOKEN } from '@/shared/constants/timesheetStatus'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDayMonth, formatHours } from '@/shared/lib/formatters'

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
  context = null,
  onClose,
}: {
  entry: TimesheetEntry | null
  workerName: string
  /** Identidad del hero (fotos y hotel); sin él, el hero degrada con calma. */
  context?: ReviewContext | null
  onClose: () => void
}): ReactNode {
  const [note, setNote] = useState('')
  const [reviewDay, { isLoading, isError, error: saveError }] = useReviewTimesheetDayMutation()
  /** El onboarding se ve UNA vez por navegador; después, directo a las marcas. */
  const { isIntroOpen, dismissIntro } = useIntroSeen('revision-dia')
  const [showIntro, setShowIntro] = useState(false)

  useEffect(() => {
    setNote(entry?.reviewNote ?? '')
    if (entry) setShowIntro(isIntroOpen)
  }, [entry, isIntroOpen])

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
    toast.success('Día revisado')
    onClose()
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Revisión del día"
      {...(IS_DEV_UI ? { description: 'operations.timesheet_day' } : {})}
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
            dismissIntro()
            setShowIntro(false)
          }}
        />
      ) : (
        <>
          {/* El hero: la foto del hotel de fondo bajo cristal, la persona al
              centro y el resumen del día en tiles — la ficha antes del acta. */}
          <div className="relative overflow-hidden rounded-xl">
            <HotelPhotoBackdrop photoUrl={context?.hotelPhotoUrl ?? null} />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-b from-ink/45 via-ink/60 to-ink/80"
            />
            <div className="relative flex flex-col items-center gap-1.5 px-4 py-5 text-center">
              {context?.workerPhotoUrl ? (
                <img
                  src={context.workerPhotoUrl}
                  alt=""
                  className="size-16 rounded-full object-cover ring-2 ring-white/70"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <span
                  aria-hidden
                  className="flex size-16 items-center justify-center rounded-full bg-o-500 text-xl font-bold text-ink ring-2 ring-white/70"
                >
                  {workerName.charAt(0)}
                </span>
              )}
              <p className="text-lg font-bold text-white">{workerName}</p>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {context?.hotelName != null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white">
                    <MaterialIcon name="apartment" className="text-sm" aria-hidden />
                    {context.hotelName}
                  </span>
                )}
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white">
                  {formatDayMonth(entry.date)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: statusLight[TIMESHEET_STATUS_TOKEN[entry.status]] }}
                    aria-hidden
                  />
                  {TIMESHEET_STATUS_LABEL[entry.status]}
                </span>
              </div>

              <div className="mt-3 grid w-full grid-cols-2 gap-2">
                <div className="flex items-center gap-2.5 rounded-lg bg-white/95 p-2.5 text-left">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-o-50">
                    <MaterialIcon name="schedule" className="text-lg text-o-700" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10px] text-ink-3">Horas netas</span>
                    <span className="block truncate text-base font-bold text-ink">
                      {entry.hours === null ? '—' : formatHours(entry.hours)}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg bg-white/95 p-2.5 text-left">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-purple/10">
                    <MaterialIcon name="login" className="text-lg text-purple" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10px] text-ink-3">Entrada – Salida</span>
                    <span className="block truncate text-base font-bold text-ink">
                      {entry.startTime === null || entry.endTime === null
                        ? '—'
                        : `${entry.startTime} – ${entry.endTime}`}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

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
                    className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 rounded-md bg-surface-2 px-3 py-2 text-sm"
                  >
                    <span className="font-semibold text-ink">
                      {PUNCH_TYPE_LABEL[punch.type] ?? punch.type}
                    </span>
                    {/* Solo la EXCEPCIÓN habla: dentro de la geocerca es lo
                        esperado y no se anuncia cuatro veces. */}
                    <span className="text-xs font-semibold text-red">
                      {punch.isManual
                        ? `Manual · ${punch.manualReason ?? 'sin motivo'}`
                        : punch.insideGeofence === false
                          ? 'Fuera de la geocerca'
                          : ''}
                    </span>
                    {/* Un solo reloj cuando coinciden; los dos SOLO si difieren
                        (la discrepancia es el dato — D-08: manda el servidor). */}
                    {punch.deviceTime !== null && punch.deviceTime !== punch.serverTime ? (
                      <span className="text-xs text-ink-3">
                        teléfono {punch.deviceTime} ·{' '}
                        <span className="font-semibold text-ink-2">
                          servidor {punch.serverTime}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-ink-2">{punch.serverTime}</span>
                    )}
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
