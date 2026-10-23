import type {
  MessagingTemplate,
  MessagingTemplates,
  TemplatesSyncResult,
} from './messagingTemplatesApi'

import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

/** Cuatro plantillas, las mismas que cuenta el Panel simulado. */
const templates: MessagingTemplate[] = [
  {
    id: 'tpl-hello',
    name: 'hello_world',
    category: 'UTILITY',
    language: 'en_US',
    status: 'APPROVED',
    variableCount: 0,
    body: 'Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API.',
    rejectionReason: null,
    syncedAt: '2026-09-11T15:20:00.000Z',
  },
  {
    id: 'tpl-turno',
    name: 'turno_confirmado',
    category: 'UTILITY',
    language: 'es_MX',
    status: 'APPROVED',
    variableCount: 2,
    body: 'Hola {{1}}, tu turno en {{2}} quedó confirmado. ¡Te esperamos!',
    rejectionReason: null,
    syncedAt: '2026-10-20T10:00:00.000Z',
  },
  {
    id: 'tpl-vacante',
    name: 'nueva_vacante',
    category: 'MARKETING',
    language: 'es_MX',
    status: 'PENDING',
    variableCount: 1,
    body: '{{1}}, hay una vacante nueva cerca de ti. Responde SÍ para apartarla.',
    rejectionReason: null,
    syncedAt: '2026-10-21T18:30:00.000Z',
  },
  {
    id: 'tpl-promo',
    name: 'promo_referidos',
    category: 'MARKETING',
    language: 'es',
    status: 'REJECTED',
    variableCount: 0,
    body: '¡Gana $500 por cada amigo que traigas a Oranje!',
    rejectionReason: 'INVALID_FORMAT',
    syncedAt: '2026-10-19T09:15:00.000Z',
  },
]

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/messaging/templates',
    resolve: (): ApiEnvelope<MessagingTemplates> => ({
      data: { configured: true, templates: templates.map((template) => ({ ...template })) },
    }),
  },
  {
    method: 'POST',
    path: '/messaging/templates/sync',
    resolve: (): ApiEnvelope<TemplatesSyncResult> => ({
      data: { synced: templates.length, created: 0, updated: templates.length },
    }),
  },
]

/** El nombre de una plantilla simulada, para la campaña que se crea con ella. */
export function mockTemplateName(id: string): string | null {
  return templates.find((template) => template.id === id)?.name ?? null
}

export function registerMessagingTemplatesMocks(): void {
  registerMockRoutes(routes)
}
