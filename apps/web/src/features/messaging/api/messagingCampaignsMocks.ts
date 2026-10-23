import type { CampaignStatus } from './messagingApi'
import type { CreateMessagingCampaignInput } from './messagingCampaignCreateApi'
import type { CampaignAction, MessagingCampaign, MessagingCampaigns } from './messagingCampaignsApi'
import { mockTemplateName } from './messagingTemplatesMocks'

import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

/** Una campaña por estado que tiene acciones, más la prueba real de la oficina. */
const campaigns: MessagingCampaign[] = [
  {
    id: 'cmp-noviembre',
    name: 'Turnos de noviembre',
    description: 'Confirmación de turnos para la primera quincena',
    templateName: 'turno_confirmado',
    status: 'SENDING',
    totalRecipients: 120,
    sentCount: 80,
    deliveredCount: 70,
    readCount: 41,
    failedCount: 3,
    scheduledAt: null,
    startedAt: '2026-10-22T15:00:00.000Z',
    completedAt: null,
    createdAt: '2026-10-22T14:55:00.000Z',
  },
  {
    id: 'cmp-vacantes',
    name: 'Vacantes Cancún',
    description: null,
    templateName: 'nueva_vacante',
    status: 'DRAFT',
    totalRecipients: 45,
    sentCount: 0,
    deliveredCount: 0,
    readCount: 0,
    failedCount: 0,
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    createdAt: '2026-10-21T18:40:00.000Z',
  },
  {
    id: 'cmp-octubre',
    name: 'Recordatorio de octubre',
    description: null,
    templateName: 'turno_confirmado',
    status: 'PAUSED',
    totalRecipients: 60,
    sentCount: 25,
    deliveredCount: 24,
    readCount: 10,
    failedCount: 1,
    scheduledAt: null,
    startedAt: '2026-10-15T16:00:00.000Z',
    completedAt: null,
    createdAt: '2026-10-15T15:50:00.000Z',
  },
  {
    id: 'cmp-prueba-oficina',
    name: 'Prueba oficina',
    description: null,
    templateName: 'hello_world',
    status: 'COMPLETED',
    totalRecipients: 3,
    sentCount: 3,
    deliveredCount: 3,
    readCount: 2,
    failedCount: 0,
    scheduledAt: null,
    startedAt: '2026-09-11T15:30:00.000Z',
    completedAt: '2026-09-11T15:31:00.000Z',
    createdAt: '2026-09-11T15:29:00.000Z',
  },
]

/** Las mismas reglas de estado que la plataforma (campaigns.service de meta-mensajes). */
const TRANSITIONS: Record<CampaignAction, { from: CampaignStatus[]; to: CampaignStatus }> = {
  send: { from: ['DRAFT', 'SCHEDULED'], to: 'SENDING' },
  pause: { from: ['SENDING'], to: 'PAUSED' },
  resume: { from: ['PAUSED'], to: 'SENDING' },
  cancel: {
    from: ['DRAFT', 'SCHEDULED', 'SENDING', 'PAUSED', 'FAILED'],
    to: 'CANCELLED',
  },
}

const routes: readonly MockRoute[] = [
  {
    method: 'POST',
    path: '/messaging/campaigns',
    resolve: ({ body }): ApiEnvelope<MessagingCampaign> => {
      const input = body as CreateMessagingCampaignInput
      const campaign: MessagingCampaign = {
        id: `cmp-${String(Date.now())}`,
        name: input.name,
        description: input.description ?? null,
        templateName: mockTemplateName(input.templateId),
        status: 'DRAFT',
        // Como si cada etiqueta de más acotara el grupo.
        totalRecipients: Math.max(0, 14 - 4 * (input.tagIds.length - 1)),
        sentCount: 0,
        deliveredCount: 0,
        readCount: 0,
        failedCount: 0,
        scheduledAt: null,
        startedAt: null,
        completedAt: null,
        createdAt: new Date().toISOString(),
      }
      campaigns.unshift(campaign)
      return { data: { ...campaign } }
    },
  },
  {
    method: 'GET',
    path: '/messaging/campaigns',
    resolve: ({ search }): ApiEnvelope<MessagingCampaigns> => {
      const page = Number(search.get('page') ?? '1')
      const limit = Number(search.get('limit') ?? '20')
      const status = search.get('status')
      const matching = campaigns.filter((campaign) => status === null || campaign.status === status)
      return {
        data: {
          configured: true,
          campaigns: matching
            .slice((page - 1) * limit, page * limit)
            .map((campaign) => ({ ...campaign })),
          pagination: {
            page,
            limit,
            total: matching.length,
            totalPages: Math.max(1, Math.ceil(matching.length / limit)),
          },
        },
      }
    },
  },
  ...(Object.keys(TRANSITIONS) as CampaignAction[]).map((action): MockRoute => ({
    method: 'POST',
    path: `/messaging/campaigns/:id/${action}`,
    resolve: ({ params }): null => {
      const index = campaigns.findIndex((campaign) => campaign.id === params.id)
      const campaign = campaigns[index]
      if (campaign === undefined) throw new Error('Campaña no encontrada')
      const { from, to } = TRANSITIONS[action]
      if (!from.includes(campaign.status)) {
        throw new Error(`No se puede hacer eso con una campaña en estado ${campaign.status}`)
      }
      /* RTK congela lo que ya sirvió: se reemplaza por una copia. */
      campaigns[index] = { ...campaign, status: to }
      return null
    },
  })),
]

export function registerMessagingCampaignsMocks(): void {
  registerMockRoutes(routes)
}
