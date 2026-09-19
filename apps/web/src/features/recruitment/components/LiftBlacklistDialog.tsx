import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Alert, AlertDescription, toast } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import { useLiftBlacklistMutation } from '../api/blacklistApi'
import { BLACKLIST_SOURCE_LABEL, type BlacklistRow } from '../types/blacklist.types'

import personajeAyuda from '@/assets/ilustrations/personaje-ayuda.svg'
import personajeComencemos from '@/assets/ilustrations/personaje-comencemos.svg'
import personajeRetro from '@/assets/ilustrations/personaje-retroalimentacion.svg'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDayMonth } from '@/shared/lib/formatters'

function EntryField({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-ink-4">{label}</span>
      <span className="text-right text-sm text-ink-2">{value}</span>
    </div>
  )
}

/** Las diapositivas del intro; el texto se traduce al pintar con `i18n._()` (D-36). */
const INTRO_SLIDES: readonly {
  image: string
  title: MessageDescriptor
  text: MessageDescriptor
}[] = [
  {
    image: personajeAyuda,
    title: msg`Solo el Administrador levanta`,
    text: msg`El veto lo puede quitar únicamente el Administrador; si no eres tú, el sistema va a rechazar la acción.`,
  },
  {
    image: personajeComencemos,
    title: msg`Vuelve a Blanco, no al Pool`,
    text: msg`Al levantarlo, la persona reingresa por la validación de la Reclutadora, como si empezara.`,
  },
  {
    image: personajeRetro,
    title: msg`El historial queda`,
    text: msg`La fila no se borra: se marca levantada con tu motivo, y el pasado sigue consultable.`,
  },
]

export function LiftBlacklistDialog({
  row,
  onClose,
}: {
  row: BlacklistRow | null
  onClose: () => void
}): ReactNode {
  const { t, i18n } = useLingui()
  const [liftReason, setLiftReason] = useState('')
  const [lift, { isLoading, error }] = useLiftBlacklistMutation()
  const [showIntro, setShowIntro] = useState(false)

  useEffect(() => {
    setLiftReason('')
    if (row) setShowIntro(true)
  }, [row])

  if (!row) return null

  async function submit(): Promise<void> {
    if (!row || liftReason.trim() === '') return
    try {
      await lift({ workerId: row.workerId, liftReason: liftReason.trim() }).unwrap()
      toast.success(t`Veto levantado — vuelve a Blanco`)
      onClose()
    } catch {
      return
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t`Levantar de Blacklist`}
      description={
        IS_DEV_UI
          ? 'coverage.blacklist_entry · la fila no se borra: se marca como levantada'
          : t`El veto no se borra: queda en el historial como levantado, con tu motivo`
      }
      className="max-w-xl"
      footer={
        showIntro ? null : (
          <>
            <Button onClick={onClose} disabled={isLoading}>
              <Trans>Cancelar</Trans>
            </Button>
            <Button
              variant="primary"
              disabled={liftReason.trim() === '' || isLoading}
              onClick={() => {
                void submit()
              }}
            >
              {isLoading ? t`Levantando…` : t`Levantar el veto`}
            </Button>
          </>
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
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-semibold text-ink">{row.workerName}</p>
            <StatusLightSoftBadge token="st-negro" label={t`BLACK · Blacklist`} />
          </div>

          <div className="flex flex-col gap-2 rounded-md bg-surface-2 p-4">
            <EntryField
              label={IS_DEV_UI ? 'source' : t`Origen`}
              value={IS_DEV_UI ? row.source : BLACKLIST_SOURCE_LABEL[row.source]}
            />
            <EntryField label={IS_DEV_UI ? 'reason' : t`Motivo`} value={row.reason} />
            <EntryField
              label={IS_DEV_UI ? 'evidence_path' : t`Evidencia`}
              value={row.evidencePath ?? '—'}
            />
            <EntryField label={IS_DEV_UI ? 'entered_by' : t`Registró`} value={row.enteredByName} />
            <EntryField
              label={IS_DEV_UI ? 'occurred_at' : t`Fecha`}
              value={formatDayMonth(row.occurredAt)}
            />
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-ink">
              <Trans>
                Motivo del levantamiento{' '}
                <span className="font-normal text-ink-3">(obligatorio)</span>
              </Trans>
              {IS_DEV_UI && <code className="text-xs font-normal text-ink-4"> · lift_reason</code>}
            </span>
            <textarea
              value={liftReason}
              onChange={(event) => {
                setLiftReason(event.target.value)
              }}
              rows={3}
              placeholder={t`P. ej. «Acuerdo con el hotel; reincorporación autorizada por el Manager de Reclutamiento.»`}
              className="rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none"
            />
          </label>

          <p className="rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-ink-3">
            <Trans>
              Al levantarlo, el colaborador vuelve a <span className="font-semibold">Blanco</span> —
              no a disponible: reingresa por la validación de la Reclutadora.
            </Trans>
          </p>

          {error !== undefined && (
            <Alert variant="destructive">
              <AlertDescription>
                {apiErrorMessage(error, {
                  byStatus: {
                    403: t`Solo el Administrador puede levantar un veto${IS_DEV_UI ? ' (blacklist:lift)' : ''}: pídeselo.`,
                  },
                  fallback: t`No se pudo levantar el veto. Inténtalo de nuevo.`,
                })}
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </Modal>
  )
}
