import type { I18n, MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Alert,
  AlertDescription,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import { useReportWorkerMutation } from '../api/personnelApi'

import personajeEncuesta from '@/assets/ilustrations/personaje-encuesta.svg'
import personajeErrorTecnico from '@/assets/ilustrations/personaje-error-tecnico.svg'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { apiErrorMessage } from '@/shared/lib/apiError'

/** Las diapositivas del intro; el texto se traduce al pintar con `i18n._()` (D-36). */
const INTRO_SLIDES: readonly {
  image: string
  title: MessageDescriptor
  text: MessageDescriptor
}[] = [
  {
    image: personajeErrorTecnico,
    title: msg`Reportar es más serio que Stand-by`,
    text: msg`El colaborador pasa a Rojo: es una incidencia, no una pausa — Inspección la revisa y decide si vuelve o queda fuera.`,
  },
  {
    image: personajeEncuesta,
    title: msg`El motivo queda en su historia`,
    text: msg`Es obligatorio decir por qué: el motivo acompaña la transición en el historial del colaborador.`,
  },
]

/** El `i18n` viene del componente (`useLingui`): así el mensaje habla el idioma activo (D-36). */
function reportErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    fallback: i18n._(msg`No se pudo reportar al colaborador. Inténtalo de nuevo.`),
  })
}

/**
 * Reportar a un colaborador (Rojo): la transición existía en el semáforo y el
 * permiso `staff:report` estaba sembrado desde hace semanas, pero nada en el
 * front la ofrecía — el mismo hallazgo que «Agregar turno» del Schedule.
 */
export function ReportWorkerDialog({
  workerId,
  workerName,
  isOpen,
  onClose,
}: {
  workerId: string
  workerName: string
  isOpen: boolean
  onClose: () => void
}): ReactNode {
  const { t, i18n } = useLingui()
  const [report, { isLoading, isError, error: reportError }] = useReportWorkerMutation()
  const [reasonCode, setReasonCode] = useState('')
  const [note, setNote] = useState('')
  const [showIntro, setShowIntro] = useState(false)

  useEffect(() => {
    if (isOpen) setShowIntro(true)
  }, [isOpen])

  const canSubmit = reasonCode !== '' && !isLoading

  async function submit(): Promise<void> {
    if (!canSubmit) return
    try {
      await report({
        workerId,
        reasonCode,
        ...(note.trim() ? { note: note.trim() } : {}),
      }).unwrap()
      toast.success(t`${workerName} quedó reportado`)
      setReasonCode('')
      setNote('')
      onClose()
    } catch {
      return
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t`Reportar a ${workerName}`}
      description={t`Pasa a Rojo: es una incidencia, no una pausa. Inspección la revisa.`}
      footer={
        showIntro ? null : (
          <div className="flex justify-end gap-3">
            <Button onClick={onClose} disabled={isLoading}>
              <Trans>Cancelar</Trans>
            </Button>
            <Button
              variant="primary"
              disabled={!canSubmit}
              onClick={() => {
                void submit()
              }}
            >
              {isLoading ? t`Reportando…` : t`Reportar`}
            </Button>
          </div>
        )
      }
    >
      {showIntro ? (
        <OnboardingIntro
          slides={INTRO_SLIDES.map((slide) => ({
            image: slide.image,
            title: i18n._(slide.title),
            text: i18n._(slide.text),
          }))}
          startLabel={t`Continuar`}
          onDone={() => {
            setShowIntro(false)
          }}
        />
      ) : (
        <>
          {/* Mismo catálogo que Stand-by (`catalogs.light_reason`, luz WORKER): el back lo valida. */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-3">
              <Trans>Motivo</Trans>
            </span>
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger aria-label={t`Motivo del reporte`}>
                <SelectValue placeholder={t`Elige el motivo…`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SERIOUS_MISCONDUCT">
                  <Trans>Falta grave en el hotel</Trans>
                </SelectItem>
                <SelectItem value="ABSENCES">
                  <Trans>Inasistencias</Trans>
                </SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="mt-3 flex flex-col gap-1.5">
            <span className="text-sm text-ink-3">
              <Trans>Nota (opcional)</Trans>
            </span>
            <textarea
              value={note}
              onChange={(event) => {
                setNote(event.target.value)
              }}
              rows={3}
              placeholder={t`Qué pasó y cuándo…`}
              className="w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none"
            />
          </label>
          {isError && (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription>{reportErrorMessage(reportError, i18n)}</AlertDescription>
            </Alert>
          )}
        </>
      )}
    </Modal>
  )
}
