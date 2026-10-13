import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'

import personajeContabilidad from '@/assets/ilustrations/personaje-contabilidad.svg'
import { EmptyState } from '@/shared/components/EmptyState'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'

interface PendingScreen {
  /** Clave del intro (`useIntroSeen`): se ve una vez por pantalla. */
  key: string
  title: MessageDescriptor
  summary: MessageDescriptor
  emptyTitle: MessageDescriptor
  emptyText: MessageDescriptor
  slides: ReadonlyArray<{ title: MessageDescriptor; text: MessageDescriptor }>
}

const PRE_PAYROLL: PendingScreen = {
  key: 'accounting-pre-payroll',
  title: msg`Pre-Payroll`,
  summary: msg`El neto de cada colaborador antes de pagarle: sale del Consolidado con rate interno, deducciones y overtime autorizado.`,
  emptyTitle: msg`Todavía sin datos conectados`,
  emptyText: msg`El Pre-Payroll se arma desde el Consolidado Semanal y las deducciones. Cuando esos datos se conecten a esta pantalla, aparecerán aquí.`,
  slides: [
    {
      title: msg`Antes de pagar, se revisa`,
      text: msg`Cada línea se compara contra el Timesheet aprobado: horas, rate y descuentos.`,
    },
  ],
}

const DEDUCTIONS: PendingScreen = {
  key: 'accounting-deductions',
  title: msg`Deducciones`,
  summary: msg`Uniforme, comida y retención del 16% que se descuentan del pago del colaborador.`,
  emptyTitle: msg`Todavía sin datos conectados`,
  emptyText: msg`Las deducciones se capturan por consolidado. Esta pantalla las listará cuando el catálogo y el registro estén conectados.`,
  slides: [
    {
      title: msg`Descuentos con nombre`,
      text: msg`Cada deducción dice de dónde sale, para que la Contadora pueda cotejarla.`,
    },
  ],
}

const VACATIONS: PendingScreen = {
  key: 'accounting-vacations',
  title: msg`Vacaciones`,
  summary: msg`Los días de vacaciones de los colaboradores y cómo se pagan.`,
  emptyTitle: msg`Todavía sin datos conectados`,
  emptyText: msg`Las vacaciones aún no tienen reglas ni registro en el sistema. Esta pantalla se llenará cuando existan.`,
  slides: [
    {
      title: msg`Pendiente de definir`,
      text: msg`Esta pantalla existe para que el módulo tenga su lugar; sus reglas siguen en el vault.`,
    },
  ],
}

function PendingScreenPage({ screen }: { screen: PendingScreen }): ReactNode {
  const { t, i18n } = useLingui()
  const { isIntroOpen, dismissIntro, reopenIntro } = useIntroSeen(screen.key)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{i18n._(screen.title)}</h1>
        <p className="mt-1.5 text-sm text-ink-3">
          {i18n._(screen.summary)}
          {' · '}
          <button
            type="button"
            onClick={reopenIntro}
            className="cursor-pointer font-medium text-o-700 hover:underline"
          >
            <Trans>¿Cómo funciona?</Trans>
          </button>
        </p>
      </header>

      <EmptyState
        title={i18n._(screen.emptyTitle)}
        text={i18n._(screen.emptyText)}
        image={personajeContabilidad}
      />

      <Modal
        isOpen={isIntroOpen}
        onClose={dismissIntro}
        title={t`Cómo funciona`}
        chromeless
        className="max-w-2xl"
      >
        <OnboardingIntro
          slides={screen.slides.map((slide) => ({
            image: personajeContabilidad,
            title: i18n._(slide.title),
            text: i18n._(slide.text),
          }))}
          startLabel={t`Entendido`}
          onDone={dismissIntro}
        />
      </Modal>
    </div>
  )
}

export function PrePayrollPage(): ReactNode {
  return <PendingScreenPage screen={PRE_PAYROLL} />
}

export function DeductionsPage(): ReactNode {
  return <PendingScreenPage screen={DEDUCTIONS} />
}

export function VacationsPage(): ReactNode {
  return <PendingScreenPage screen={VACATIONS} />
}
