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
 */
interface HelpStep {
  status: OnboardingStatus
  /** Quién autoriza la SALIDA de este estado hacia el siguiente del camino. */
  movedBy: string
  detail?: string
}

/** El camino directo a cliente, en orden. */
const MAIN_PATH: HelpStep[] = [
  { status: 'GRAY', movedBy: 'BD' },
  { status: 'LIGHT_BLUE', movedBy: 'BD' },
  {
    status: 'GREEN',
    movedBy: 'BD',
    detail: 'De Verde no se sale sin la Propuesta Personalizada enviada.',
  },
  { status: 'YELLOW', movedBy: 'BD' },
  {
    status: 'PINK',
    movedBy: 'BDC',
    detail: 'La conversión a cliente es exclusiva del BDC y exige el Usuario del Hotel creado.',
  },
  { status: 'ORANGE', movedBy: '—', detail: 'Meta del ciclo: el hotel ya es cliente.' },
]

/** Las ramas: salidas del camino y su reactivación (siempre hacia Azul claro). */
const BRANCHES: Array<{
  status: OnboardingStatus
  enteredFrom: string
  reactivatedBy: string
}> = [
  { status: 'RED', enteredFrom: 'desde Verde, por el BD', reactivatedBy: 'BD' },
  {
    status: 'BROWN',
    enteredFrom: 'desde Verde (BD o BDC) o desde Rosa (BDC)',
    reactivatedBy: 'BDC',
  },
  { status: 'BLACK', enteredFrom: 'desde Naranja, por el BDC', reactivatedBy: 'BDC' },
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
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cómo funciona el semáforo"
      description="El ciclo comercial del hotel: de prospecto a cliente."
      className="max-w-xl"
    >
      <div className="flex flex-col gap-5">
        <img src={personajeAyuda} alt="" aria-hidden className="mx-auto h-32 w-auto" />
        <section>
          <h3 className="text-sm font-semibold text-ink">El camino a cliente</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">
            Cada estado avanza solo hacia el siguiente; el semáforo nunca retrocede.
          </p>
          <ol className="mt-3">
            {MAIN_PATH.map((step, index) => (
              <StatusRow
                key={step.status}
                status={step.status}
                right={step.movedBy === '—' ? 'aquí termina el ciclo' : `avanza el ${step.movedBy}`}
                detail={step.detail}
                isLast={index === MAIN_PATH.length - 1}
              />
            ))}
          </ol>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-ink">Las ramas: salir y volver</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">
            «Regresar» un prospecto es salir por una rama y reactivarlo. La reentrada es siempre
            hacia Azul claro, el único punto de retorno: se retoma el contacto, no la propuesta
            vieja.
          </p>
          <ul className="mt-3">
            {BRANCHES.map((branch, index) => (
              <StatusRow
                key={branch.status}
                status={branch.status}
                right={`entra ${branch.enteredFrom}`}
                detail={`Reactiva hacia Azul claro: ${branch.reactivatedBy === 'BD' ? 'el BD' : 'solo el BDC'}.`}
                isLast={index === BRANCHES.length - 1}
              />
            ))}
          </ul>
        </section>

        <p className="rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-ink-3">
          Salir por una rama pide siempre el motivo, que queda en el historial del prospecto. Cerrar
          el ciclo (archivarlo) es un acto aparte: libera al hotel para un ciclo nuevo.
        </p>
      </div>
    </Modal>
  )
}

/** Icono de ayuda que abre el diálogo. Se ancla junto a lo que explica. */
export function SemaforoHelpButton({ className }: { className?: string }): ReactNode {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        aria-label="Cómo funciona el semáforo"
        title="Cómo funciona el semáforo"
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
