import type { CorporateEmailRow, MailboxCredential } from './corporateEmailApi'

import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

/** Tres casos: buzón ya creado, sin crear, y uno que "falla" al crear (cPanel abajo). */
const rows: CorporateEmailRow[] = [
  {
    workerId: 'wrk-corp-1',
    workerName: 'Ana Rivera Gómez',
    photoUrl: null,
    email: 'arivera@oranjepeople.com',
    isActive: true,
    mailboxExists: true,
  },
  {
    workerId: 'wrk-corp-2',
    workerName: 'Luis Cabrera',
    photoUrl: null,
    email: 'lcabrera@oranjepeople.com',
    isActive: true,
    mailboxExists: false,
  },
  {
    workerId: 'wrk-corp-3',
    workerName: 'Rogelio Santos',
    photoUrl: null,
    email: 'rsantos@oranjepeople.com',
    isActive: false,
    mailboxExists: false,
  },
]

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/corporate-email',
    resolve: (): ApiEnvelope<CorporateEmailRow[]> => ({ data: rows.map((row) => ({ ...row })) }),
  },
  {
    method: 'POST',
    path: '/corporate-email/:workerId/mailbox',
    resolve: ({ params }): ApiEnvelope<MailboxCredential> => {
      const row = rows.find((item) => item.workerId === params.workerId)
      if (!row) throw new Error('WORKER_NOT_FOUND')
      row.mailboxExists = true
      return { data: { email: row.email, password: 'x7Kp2qVmZ4nWs9Ld' } }
    },
  },
  {
    method: 'POST',
    path: '/corporate-email/:workerId/mailbox/reset-password',
    resolve: ({ params }): ApiEnvelope<MailboxCredential> => {
      const row = rows.find((item) => item.workerId === params.workerId)
      if (!row) throw new Error('WORKER_NOT_FOUND')
      return { data: { email: row.email, password: 'q3Rt8bYcH1jXe6Fp' } }
    },
  },
  {
    method: 'DELETE',
    path: '/corporate-email/:workerId/mailbox',
    resolve: ({ params }): { ok: true } => {
      const row = rows.find((item) => item.workerId === params.workerId)
      if (!row) throw new Error('WORKER_NOT_FOUND')
      row.mailboxExists = false
      return { ok: true }
    },
  },
]

let registered = false

export function registerCorporateEmailMocks(): void {
  if (registered) return
  registered = true
  registerMockRoutes(routes)
}
