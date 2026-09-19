import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon, cn } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import personajeAyuda from '@/assets/ilustrations/personaje-ayuda.svg'
import { Modal } from '@/shared/components/Modal'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  ONBOARDING_STATUS_DESCRIPTION,
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
  type OnboardingStatus,
} from '@/shared/constants/onboardingStatus'

/**
 * Un paso del semáforo: el chip, qué significa y quién lo mueve al siguiente.
 * Los datos son los del seed (`catalogs.status_light_transition`): si aquella
 * tabla cambia, esta ayuda queda mintiendo — actualizarla junto con el seed.
 *
 * `movedBy`/`reactivatedBy` guardan el rol tal cual (BD/BDC), no prosa: se
 * traducen solo las frases que los envuelven. El texto se traduce al pintar
 * con `i18n._()` (D-36).
 */
interface HelpStep {
  status: OnboardingStatus
  /** Quién autoriza la SALIDA de este estado hacia el siguiente del camino; `null` = fin del camino. */
  movedBy: 'BD' | 'BDC' | null
  detail?: MessageDescriptor
}

/** El camino directo a cliente, en orden. */
const MAIN_PATH: HelpStep[] = [
  { status: 'GRAY', movedBy: 'BD' },
  { status: 'LIGHT_BLUE', movedBy: 'BD' },
  {
    status: 'GREEN',
    movedBy: 'BD',
    detail: msg`De Verde no se sale sin la Propuesta Personalizada enviada.`,
  },
  { status: 'YELLOW', movedBy: 'BD' },
  {
    status: 'PINK',
    movedBy: 'BDC',
    detail: msg`La conversión a cliente es exclusiva del BDC y exige el Usuario del Hotel creado.`,
  },
  { status: 'ORANGE', movedBy: null, detail: msg`Meta del ciclo: el hotel ya es cliente.` },
]

/** Las ramas: salidas del camino y su reactivación (siempre hacia Azul claro). */
const BRANCHES: Array<{
  status: OnboardingStatus
  enteredFrom: MessageDescriptor
  reactivatedBy: 'BD' | 'BDC'
}> = [
  { status: 'RED', enteredFrom: msg`desde Verde, por el BD`, reactivatedBy: 'BD' },
  {
    status: 'BROWN',
    enteredFrom: msg`desde Verde (BD o BDC) o desde Rosa (BDC)`,
    reactivatedBy: 'BDC',
  },
  { status: 'BLACK', enteredFrom: msg`desde Naranja, por el BDC`, reactivatedBy: 'BDC' },
]

function StatusRow({
  status,
  right,
  detail,
  isLast = false,
}: {
  status: OnboardingStatus
  right: ReactNode
  detail?: string | undefined
  isLast?: boolean
}): ReactNode {
  return (
    <li className={cn('flex gap-3', !isLast && 'pb-4')}>
      <div className="flex flex-col items-center">
        <StatusLightSoftBadge
          token={ONBOARDING_STATUS_TOKEN[status]}
          label={ONBOARDING_STATUS_LABEL[status]}
        />
        {!isLast && <span aria-hidden className="mt-1 w-px flex-1 bg-line" />}
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm text-ink">
          {ONBOARDING_STATUS_DESCRIPTION[status]}
          <span className="text-ink-3"> · {right}</span>
        </p>
        {detail && <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{detail}</p>}
      </div>
    </li>
  )
}

/**
 * Cómo funciona el Semáforo Onboarding y quién mueve cada estado. Es la
 * respuesta larga a la nota corta del diálogo de transición: el camino
 * completo, las ramas y las tres reglas que más confunden.
 */
export function SemaforoHelpDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}): ReactNode {
  const { t, i18n } = useLingui()

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t`Cómo funciona el semáforo`}
      description={t`El ciclo comercial del hotel: de prospecto a cliente.`}
      className="max-w-xl"
    >
      <div className="flex flex-col gap-5">
        <img src={personajeAyuda} alt="" aria-hidden className="mx-auto h-32 w-auto" />
        <section>
          <h3 className="text-sm font-semibold text-ink">
            <Trans>El camino a cliente</Trans>
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">
            <Trans>Cada estado avanza solo hacia el siguiente; el semáforo nunca retrocede.</Trans>
          </p>
          <ol className="mt-3">
            {MAIN_PATH.map((step, index) => (
              <StatusRow
                key={step.status}
                status={step.status}
                right={
                  step.movedBy === null
                    ? i18n._(msg`aquí termina el ciclo`)
                    : i18n._(msg`avanza el ${step.movedBy}`)
                }
                detail={step.detail ? i18n._(step.detail) : undefined}
                isLast={index === MAIN_PATH.length - 1}
              />
            ))}
          </ol>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-ink">
            <Trans>Las ramas: salir y volver</Trans>
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">
            <Trans>
              «Regresar» un prospecto es salir por una rama y reactivarlo. La reentrada es siempre
              hacia Azul claro, el único punto de retorno: se retoma el contacto, no la propuesta
              vieja.
            </Trans>
          </p>
          <ul className="mt-3">
            {BRANCHES.map((branch, index) => {
              const reactivatedLabel =
                branch.reactivatedBy === 'BD' ? i18n._(msg`el BD`) : i18n._(msg`solo el BDC`)
              return (
                <StatusRow
                  key={branch.status}
                  status={branch.status}
                  right={i18n._(msg`entra ${i18n._(branch.enteredFrom)}`)}
                  detail={i18n._(msg`Reactiva hacia Azul claro: ${reactivatedLabel}.`)}
                  isLast={index === BRANCHES.length - 1}
                />
              )
            })}
          </ul>
        </section>

        <p className="rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-ink-3">
          <Trans>
            Salir por una rama pide siempre el motivo, que queda en el historial del prospecto.
            Cerrar el ciclo (archivarlo) es un acto aparte: libera al hotel para un ciclo nuevo.
          </Trans>
        </p>
      </div>
    </Modal>
  )
}

/** Icono de ayuda que abre el diálogo. Se ancla junto a lo que explica. */
export function SemaforoHelpButton({ className }: { className?: string }): ReactNode {
  const { t } = useLingui()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        aria-label={t`Cómo funciona el semáforo`}
        title={t`Cómo funciona el semáforo`}
        onClick={() => {
          setIsOpen(true)
        }}
        className={cn(
          'inline-flex size-6 cursor-pointer items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink',
          className,
        )}
      >
        <MaterialIcon name="help" className="text-lg" aria-hidden />
      </button>
      <SemaforoHelpDialog
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false)
        }}
      />
    </>
  )
}
