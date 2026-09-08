import type { ReactNode } from 'react'

import { AuditHistoryList } from '../components/AuditHistoryList'
import { AuditHotelCard } from '../components/AuditHotelCard'

import { useGetSessionQuery } from '@/app/sessionApi'
import personajeComencemos from '@/assets/ilustrations/personaje-comencemos.svg'
import personajeConfiguracion from '@/assets/ilustrations/personaje-configuracion.svg'
import personajeEncuesta from '@/assets/ilustrations/personaje-encuesta.svg'
import { FoldText } from '@/shared/components/FoldText'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro, type OnboardingSlide } from '@/shared/components/OnboardingIntro'
import { useCan } from '@/shared/hooks/useCan'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const INTRO_SLIDES: readonly OnboardingSlide[] = [
  {
    image: personajeEncuesta,
    title: 'Dos auditorías, un mismo registro',
    text: 'Presentación Personal por colaborador y Percepción de Ambiente y Recursos de tu hotel — misma mecánica, categorías distintas.',
  },
  {
    image: personajeConfiguracion,
    title: 'Cada reactivo pesa lo suyo',
    text: 'Cumple, No o N/A por reactivo. El score es un promedio ponderado — N/A no cuenta ni pesa, y el peso lo define el Administrador.',
  },
  {
    image: personajeComencemos,
    title: 'Un registro sin consecuencia',
    text: 'No mueve ningún semáforo. Audita cuando quieras antes del corte semanal — el sistema te avisa conforme se acerca.',
  },
]

/**
 * Auditoría de Presentación y Ambiente: las dos auditorías semanales del
 * Supervisor sobre SU hotel. La ruta la ve todo Hotel (Supervisor, Manager de
 * Área, Manager General) para que quien no crea igual vea el historial
 * (`audits:read`); solo quien tiene `audits:create` ve el botón Auditar.
 */
export function AuditsPage(): ReactNode {
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
        Las auditorías las ve el equipo del hotel. Si crees que deberías tener acceso, pídeselo a tu
        Manager General.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          <FoldText text="Auditorías" />
        </h1>
        <p className="mt-1.5 text-sm text-ink-3">
          Presentación Personal por colaborador y Percepción de Ambiente y Recursos del hotel — un
          registro semanal que no toca ningún semáforo.
          {IS_DEV_UI && <code className="ml-1.5 text-xs text-ink-4">supervision.audit</code>}
          {' · '}
          <button
            type="button"
            onClick={reopenIntro}
            className="cursor-pointer font-medium text-o-700 hover:underline"
          >
            ¿Cómo funciona?
          </button>
        </p>
      </header>

      {hotelId === '' ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
          Tu usuario no tiene un hotel asignado todavía. Sin hotel no hay a quién auditar — pídele
          al Administrador que revise tu alta.
        </p>
      ) : (
        <>
          <AuditHotelCard hotelId={hotelId} hotelName={hotelName} canCreate={canCreate} />

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-ink">Historial</h2>
            <AuditHistoryList hotelId={hotelId} hotelName={hotelName} canUpdate={canUpdate} />
          </section>
        </>
      )}

      <Modal
        isOpen={isIntroOpen}
        onClose={dismissIntro}
        title="Cómo funciona Auditorías"
        chromeless
        className="max-w-2xl"
      >
        <OnboardingIntro slides={INTRO_SLIDES} startLabel="Ir a Auditorías" onDone={dismissIntro} />
      </Modal>
    </div>
  )
}
