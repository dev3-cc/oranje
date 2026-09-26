import type { MailSettings, MailTransport } from './mailSettingsApi'

import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

/** El ambiente simulado manda por lo nuestro, con un respaldo ya disparado. */
const estado: MailSettings = {
  transport: 'own',
  configured: true,
  sendingWithOwnServer: true,
  updatedAt: '2026-09-26T15:00:00.000Z',
  summary: { days: 7, own: 12, fallback: 1, failed: 0 },
  recent: [
    {
      template: 'account-invitation',
      toEmail: 'ana@oranjepeople.com',
      transport: 'SMTP',
      status: 'SENT',
      error: null,
      createdAt: '2026-09-26T14:20:00.000Z',
    },
    {
      template: 'account-invitation',
      toEmail: 'luis@oranjepeople.com',
      transport: 'FIREBASE',
      status: 'SENT',
      error: '550 Relay denied',
      createdAt: '2026-09-25T18:05:00.000Z',
    },
  ],
}

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/settings/mail',
    resolve: (): ApiEnvelope<MailSettings> => ({ data: { ...estado } }),
  },
  {
    method: 'PATCH',
    path: '/settings/mail',
    resolve: ({ body }): ApiEnvelope<MailSettings> => {
      const transport = (body as { transport: MailTransport }).transport

      estado.transport = transport
      estado.sendingWithOwnServer = transport === 'own'

      return { data: { ...estado } }
    },
  },
]

export function registerMailSettingsMocks(): void {
  registerMockRoutes(routes)
}
