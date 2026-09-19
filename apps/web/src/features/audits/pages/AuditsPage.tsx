import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'

import { AuditHistoryList } from '../components/AuditHistoryList'
import { AuditHotelCard } from '../components/AuditHotelCard'

import { useGetSessionQuery } from '@/app/sessionApi'
import personajeComencemos from '@/assets/ilustrations/personaje-comencemos.svg'
import personajeConfiguracion from '@/assets/ilustrations/personaje-configuracion.svg'
import personajeEncuesta from '@/assets/ilustrations/personaje-encuesta.svg'
import { FoldText } from '@/shared/components/FoldText'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { useCan } from '@/shared/hooks/useCan'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { IS_DEV_UI } from '@/shared/lib/devMode'

/** Las diapositivas del intro; el texto se traduce al pintar con `i18n._()` (D-36). */
const INTRO_SLIDES: readonly {
  image: string
  title: MessageDescriptor
  text: MessageDescriptor
}[] = [
  {
    image: personajeEncuesta,
    title: msg`Dos auditorías, un mismo registro`,
    text: msg`Presentación Personal por colaborador y Percepción de Ambiente y Recursos de tu hotel — misma mecánica, categorías distintas.`,
  },
  {
    image: personajeConfiguracion,
    title: msg`Cada reactivo pesa lo suyo`,
    text: msg`Cumple, No o N/A por reactivo. El score es un promedio ponderado — N/A no cuenta ni pesa, y el peso lo define el Administrador.`,
  },
  {
    image: personajeComencemos,
    title: msg`Un registro sin consecuencia`,
    text: msg`No mueve ningún semáforo. Audita cuando quieras antes del corte semanal — el sistema te avisa conforme se acerca.`,
  },
]

/**
 * Auditoría de Presentación y Ambiente: las dos auditorías semanales del
 * Supervisor sobre SU hotel. La ruta la ve todo Hotel (Supervisor, Manager de
 * Área, Manager General) para que quien no crea igual vea el historial
 * (`audits:read`); solo quien tiene `audits:create` ve el botón Auditar.
 */
export function AuditsPage(): ReactNode {
  const { t, i18n } = useLingui()
  const can = useCan()
  const canRead = can('audits:read')
  const canCreate = can('audits:create')
  const canUpdate = can('audits:update')

  const { data: session } = useGetSessionQuery()
  const hotelId = session?.hotel?.id ?? ''
  const hotelName = session?.hotel?.name ?? ''

  /** El intro de página se ve UNA vez; «¿Cómo funciona?» lo reabre. */
  const { isIntroOpen, dismissIntro, reopenIntro } = useIntroSeen('audits')

  if (!canRead) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
        <Trans>
          Las auditorías las ve el equipo del hotel. Si crees que deberías tener acceso, pídeselo a
          tu Manager General.
        </Trans>
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          <FoldText text={t`Auditorías`} />
        </h1>
        <p className="mt-1.5 text-sm text-ink-3">
          <Trans>
            Presentación Personal por colaborador y Percepción de Ambiente y Recursos del hotel — un
            registro semanal que no toca ningún semáforo.
          </Trans>
          {IS_DEV_UI && <code className="ml-1.5 text-xs text-ink-4">supervision.audit</code>}
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

      {hotelId === '' ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
          <Trans>
            Tu usuario no tiene un hotel asignado todavía. Sin hotel no hay a quién auditar — pídele
            al Administrador que revise tu alta.
          </Trans>
        </p>
      ) : (
        <>
          <AuditHotelCard hotelId={hotelId} hotelName={hotelName} canCreate={canCreate} />

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-ink">
              <Trans>Historial</Trans>
            </h2>
            <AuditHistoryList hotelId={hotelId} hotelName={hotelName} canUpdate={canUpdate} />
          </section>
        </>
      )}

      <Modal
        isOpen={isIntroOpen}
        onClose={dismissIntro}
        title={t`Cómo funciona Auditorías`}
        chromeless
        className="max-w-2xl"
      >
        <OnboardingIntro
          slides={INTRO_SLIDES.map((slide) => ({
            image: slide.image,
            title: i18n._(slide.title),
            text: i18n._(slide.text),
          }))}
          startLabel={t`Ir a Auditorías`}
          onDone={dismissIntro}
        />
      </Modal>
    </div>
  )
}
