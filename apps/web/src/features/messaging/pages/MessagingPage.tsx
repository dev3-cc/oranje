import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { cn } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import { MessagingCampaignsList } from '../components/MessagingCampaignsList'
import { MessagingOverviewPanel } from '../components/MessagingOverviewPanel'
import { MessagingTemplatesList } from '../components/MessagingTemplatesList'
import { MessagingWorkersList } from '../components/MessagingWorkersList'

import mascotaPensando from '@/assets/mascota/mascota-pensando.png'

type SectionId = 'panel' | 'contacts' | 'templates' | 'campaigns'

interface Section {
  id: SectionId
  label: MessageDescriptor
  description: MessageDescriptor
  icon: string
}

/* Las secciones de la plataforma de mensajería (meta-mensajes), más el Panel
   que las resume (Hugo, 2026-10-23). */
const SECTIONS: readonly [Section, ...Section[]] = [
  {
    id: 'panel',
    label: msg`Panel`,
    description: msg`Resumen de la operación`,
    icon: 'space_dashboard',
  },
  {
    id: 'contacts',
    label: msg`Colaboradores`,
    description: msg`A quién se le escribe`,
    icon: 'groups',
  },
  {
    id: 'templates',
    label: msg`Plantillas`,
    description: msg`Mensajes aprobados por Meta`,
    icon: 'article',
  },
  {
    id: 'campaigns',
    label: msg`Campañas`,
    description: msg`Envíos masivos por WhatsApp`,
    icon: 'campaign',
  },
]

export function MessagingPage(): ReactNode {
  const { i18n } = useLingui()
  const [activeId, setActiveId] = useState<SectionId>('panel')
  const active = SECTIONS.find((section) => section.id === activeId) ?? SECTIONS[0]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          <Trans>Mensajería</Trans>
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          <Trans>Mensajes por WhatsApp a colaboradores, con plantillas y campañas.</Trans>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SECTIONS.map((section) => {
          const isActive = section.id === activeId
          return (
            <button
              key={section.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                setActiveId(section.id)
              }}
              className={cn(
                'flex cursor-pointer flex-col gap-3 rounded-lg border bg-surface p-5 text-left shadow-sm transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
                isActive ? 'border-o-500' : 'border-line hover:border-o-300',
              )}
            >
              <span className="flex size-10 items-center justify-center rounded-md bg-o-50 text-o-700">
                <span className="material-icons-round text-xl leading-none" aria-hidden>
                  {section.icon}
                </span>
              </span>
              <span>
                <span
                  className={cn(
                    'block text-xs font-semibold uppercase tracking-wide',
                    isActive ? 'text-o-700' : 'text-ink-3',
                  )}
                >
                  {i18n._(section.label)}
                </span>
                <span className="mt-1 block text-sm text-ink-2">{i18n._(section.description)}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* El Panel ya lee la plataforma; las demás secciones entran al «Muy
          pronto» hasta que se construyan. */}
      {active.id === 'panel' ? (
        <section aria-label={i18n._(active.label)}>
          <MessagingOverviewPanel />
        </section>
      ) : active.id === 'contacts' ? (
        <section aria-label={i18n._(active.label)}>
          {/* Por ahora, los colaboradores de Oranje en lugar de los contactos de
              la plataforma; MessagingContactsList sigue lista para volver
              (Hugo, 2026-10-23). */}
          <MessagingWorkersList />
        </section>
      ) : active.id === 'templates' ? (
        <section aria-label={i18n._(active.label)}>
          <MessagingTemplatesList />
        </section>
      ) : active.id === 'campaigns' ? (
        <section aria-label={i18n._(active.label)}>
          <MessagingCampaignsList />
        </section>
      ) : (
        <section
          aria-label={i18n._(active.label)}
          className="rounded-lg border border-dashed border-line bg-surface p-12 text-center"
        >
          <img src={mascotaPensando} alt="" aria-hidden className="mx-auto mb-4 h-36 w-auto" />
          <p className="text-base font-semibold text-ink">
            <Trans>Muy pronto estará aquí</Trans>
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-3">
            <Trans>«{i18n._(active.label)}» de Mensajería todavía se está construyendo.</Trans>
          </p>
        </section>
      )}
    </div>
  )
}
