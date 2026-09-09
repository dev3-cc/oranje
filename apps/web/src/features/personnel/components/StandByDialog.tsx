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

import { useSendToStandByMutation } from '../api/personnelApi'

import personajeCronograma from '@/assets/ilustrations/personaje-cronograma.svg'
import personajeHastaPronto from '@/assets/ilustrations/personaje-hasta-pronto.svg'
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
    image: personajeHastaPronto,
    title: msg`Pausa, no baja`,
    text: msg`El Stand-by manda al colaborador a Rosa: sigue siendo tuyo, pero no recibe turnos nuevos hasta reactivarlo.`,
  },
  {
    image: personajeCronograma,
    title: msg`El motivo queda en su historia`,
    text: msg`Es obligatorio decir por qué: el motivo acompaña la transición en el historial del colaborador.`,
  },
]

/** El `i18n` viene del componente (`useLingui`): así el mensaje habla el idioma activo (D-36). */
function standByErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    fallback: i18n._(msg`No se pudo mandar a Stand-by. Inténtalo de nuevo.`),
  })
}

export function StandByDialog({
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
  const [send, { isLoading, isError, error: sendError }] = useSendToStandByMutation()
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
      await send({
        workerId,
        reasonCode,
        ...(note.trim() ? { note: note.trim() } : {}),
      }).unwrap()
      toast.success(t`${workerName} quedó en Stand-by`)
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
      title={t`Mandar a Stand-by a ${workerName}`}
      description={t`Pasa a Rosa: queda en pausa, sin turnos nuevos, hasta que el Hotel lo reactive.`}
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
              {isLoading ? t`Mandando…` : t`Mandar a Stand-by`}
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
          {/* El motivo sale del catálogo (encargo 12): el back lo valida y queda en la historia. */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-3">
              <Trans>Motivo</Trans>
            </span>
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger aria-label={t`Motivo del Stand-by`}>
                <SelectValue placeholder={t`Elige el motivo…`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VACATION">
                  <Trans>Vacaciones</Trans>
                </SelectItem>
                <SelectItem value="LOW_SEASON">
                  <Trans>Temporada baja</Trans>
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
              placeholder={t`Bajó el ritmo de ocupación esta semana…`}
              className="w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none"
            />
          </label>
          {isError && (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription>{standByErrorMessage(sendError, i18n)}</AlertDescription>
            </Alert>
          )}
        </>
      )}
    </Modal>
  )
}
