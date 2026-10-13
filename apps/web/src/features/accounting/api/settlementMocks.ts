import type {
  ConsolidationDetailed,
  ConsolidationRow,
  InvoiceDetailed,
  InvoiceRow,
  PendingApprovalWeek,
} from '../types/settlement.types'

import { registerMockRoutes, type MockRequest } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'
import type { ApprovalTimeliness } from '@/shared/types/approvalTimeliness.types'

/**
 * Fixtures de `settlement` en la forma CRUDA de la API. Las transiciones
 * mutan estos arreglos para que el recorrido en vivo se vea completo.
 */

const CONSOLIDATIONS: ConsolidationDetailed[] = [
  {
    id: '0b1f1c2a-0000-4000-8000-000000000001',
    worker: { id: 'w-ana', fullName: 'Ana Rivera Gómez' },
    hotel: { id: 'h-cartersville', name: 'Home2 Suites by Hilton Cartersville' },
    weekStart: '2026-09-28',
    weekEnd: '2026-10-04',
    status: 'VALIDATED',
    grossAmount: '800.00',
    deductionAmount: '73.00',
    netAmount: '727.00',
    validatedAt: '2026-10-05T14:00:00.000Z',
    authorizedAt: null,
    paidAt: null,
    details: [
      {
        id: 'd-1',
        hotelName: 'Home2 Suites by Hilton Cartersville',
        positionName: 'Housekeeper',
        regularMinutes: 2400,
        overtimeMinutes: 0,
        payRateApplied: '20.00',
        overtimeMultiplierApplied: '1.50',
        isInternalRate: false,
        subtotal: '800.00',
      },
    ],
    deductions: [
      {
        id: 'x-1',
        type: 'UNIFORM',
        amount: '25.00',
        sourceNote: 'Uniforme entregado (2 camisas)',
        refundedAt: null,
      },
      {
        id: 'x-2',
        type: 'TAX_RETENTION',
        amount: '48.00',
        sourceNote: null,
        refundedAt: null,
      },
    ],
  },
  {
    id: '0b1f1c2a-0000-4000-8000-000000000002',
    worker: { id: 'w-juan', fullName: 'Juan David Torres' },
    hotel: { id: 'h-fairfield-lithia', name: 'Fairfield by Marriott Lithia Springs' },
    weekStart: '2026-09-28',
    weekEnd: '2026-10-04',
    status: 'DRAFT',
    grossAmount: '640.00',
    deductionAmount: '0.00',
    netAmount: '640.00',
    validatedAt: null,
    authorizedAt: null,
    paidAt: null,
    details: [
      {
        id: 'd-2',
        hotelName: 'Fairfield by Marriott Lithia Springs',
        positionName: 'Front Desk Agent',
        regularMinutes: 2040,
        overtimeMinutes: 0,
        payRateApplied: '18.00',
        overtimeMultiplierApplied: '1.50',
        isInternalRate: true,
        subtotal: '612.00',
      },
    ],
    deductions: [],
  },
  {
    id: '0b1f1c2a-0000-4000-8000-000000000003',
    worker: { id: 'w-alvaro', fullName: 'Álvaro Geovanni Pérez' },
    hotel: { id: 'h-cartersville', name: 'Home2 Suites by Hilton Cartersville' },
    weekStart: '2026-09-21',
    weekEnd: '2026-09-27',
    status: 'AUTHORIZED',
    grossAmount: '960.00',
    deductionAmount: '0.00',
    netAmount: '960.00',
    validatedAt: '2026-09-29T15:00:00.000Z',
    authorizedAt: '2026-09-30T13:00:00.000Z',
    paidAt: null,
    details: [],
    deductions: [],
  },
  {
    id: '0b1f1c2a-0000-4000-8000-000000000004',
    worker: { id: 'w-ana', fullName: 'Ana Rivera Gómez' },
    hotel: { id: 'h-cartersville', name: 'Home2 Suites by Hilton Cartersville' },
    weekStart: '2026-09-21',
    weekEnd: '2026-09-27',
    status: 'PAID',
    grossAmount: '760.00',
    deductionAmount: '0.00',
    netAmount: '760.00',
    validatedAt: '2026-09-29T15:00:00.000Z',
    authorizedAt: '2026-09-30T13:00:00.000Z',
    paidAt: '2026-10-01T16:00:00.000Z',
    details: [],
    deductions: [],
  },
]

const INVOICES: InvoiceDetailed[] = [
  {
    id: 'inv-0001',
    folio: 'FAC-2026-0412',
    hotel: { id: 'h-cartersville', name: 'Home2 Suites by Hilton Cartersville' },
    status: 'SENT',
    periodStart: '2026-09-28',
    periodEnd: '2026-10-04',
    totalAmount: '1400.00',
    creditAmount: '0.00',
    approvedAt: '2026-10-03T12:00:00.000Z',
    createdAt: '2026-10-02T09:00:00.000Z',
    details: [
      {
        id: 'id-1',
        workerName: 'Ana Rivera Gómez',
        positionName: 'Housekeeper',
        regularMinutes: 2400,
        overtimeMinutes: 0,
        billRateApplied: '35.00',
        overtimeMultiplierApplied: '1.50',
        subtotal: '1400.00',
      },
    ],
  },
  {
    id: 'inv-0002',
    folio: 'FAC-2026-0413',
    hotel: { id: 'h-lithia', name: 'Fairfield by Marriott Lithia Springs' },
    status: 'DRAFT',
    periodStart: '2026-09-28',
    periodEnd: '2026-10-04',
    totalAmount: '980.00',
    creditAmount: '0.00',
    approvedAt: null,
    createdAt: '2026-10-02T09:00:00.000Z',
    details: [],
  },
  {
    id: 'inv-0003',
    folio: 'FAC-2026-0405',
    hotel: { id: 'h-cartersville', name: 'Home2 Suites by Hilton Cartersville' },
    status: 'PAID',
    periodStart: '2026-09-21',
    periodEnd: '2026-09-27',
    totalAmount: '1190.00',
    creditAmount: '0.00',
    approvedAt: '2026-09-27T12:00:00.000Z',
    createdAt: '2026-09-26T09:00:00.000Z',
    details: [],
  },
]

function summaryOf(row: ConsolidationDetailed): ConsolidationRow {
  const summary: Partial<ConsolidationDetailed> = { ...row }
  delete summary.details
  delete summary.deductions
  return summary as ConsolidationRow
}

function invoiceSummaryOf(row: InvoiceDetailed): InvoiceRow {
  const summary: Partial<InvoiceDetailed> = { ...row }
  delete summary.details
  return summary as InvoiceRow
}

function findConsolidation(request: MockRequest): ConsolidationDetailed {
  const row = CONSOLIDATIONS.find((item) => item.id === request.params.id)
  if (!row) throw new Error('NOT_FOUND')
  return row
}

function findInvoice(request: MockRequest): InvoiceDetailed {
  const row = INVOICES.find((item) => item.id === request.params.id)
  if (!row) throw new Error('NOT_FOUND')
  return row
}

/** Avanza un consolidado por el semáforo: solo desde el estado que la API exige. */
function moveConsolidation(
  request: MockRequest,
  from: string,
  to: 'VALIDATED' | 'AUTHORIZED' | 'PAID',
  stamp: 'validatedAt' | 'authorizedAt' | 'paidAt',
): ApiEnvelope<ConsolidationDetailed> {
  const row = findConsolidation(request)
  if (row.status !== from) throw new Error('CONSOLIDATION_BAD_STATUS')
  row.status = to
  row[stamp] = new Date().toISOString()
  return { data: row }
}

function moveInvoice(
  request: MockRequest,
  from: string,
  to: 'APPROVED' | 'SENT' | 'PAID',
): ApiEnvelope<InvoiceDetailed> {
  const row = findInvoice(request)
  if (row.status !== from) throw new Error('INVOICE_BAD_STATUS')
  row.status = to
  if (to === 'APPROVED') row.approvedAt = new Date().toISOString()
  return { data: row }
}

const PENDING_WEEKS: PendingApprovalWeek[] = [
  {
    hotelId: 'h-cartersville',
    hotelName: 'Home2 Suites by Hilton Cartersville',
    weekStart: '2026-09-21',
    weekEnd: '2026-09-27',
    cutoff: '2026-09-28T05:00:00.000Z',
    daysLate: 8,
    pendingTimesheets: 2,
    responsables: [
      {
        departmentName: 'Housekeeping',
        managers: [{ id: 'u-mgr-hk', fullName: 'Mariana Solís' }],
      },
      { departmentName: 'Alimentos', managers: [] },
    ],
  },
]

const TIMELINESS: ApprovalTimeliness = {
  weeks: 8,
  thresholds: { green: 95, yellow: 85 },
  overall: {
    timesheets: { total: 6, onTime: 3, late: 1, pending: 2 },
    punches: { total: 24, onTime: 16, percentage: 66.7, level: 'RED' },
    avgDaysLate: 4.5,
  },
  byHotel: [
    {
      hotelId: 'h-cartersville',
      hotelName: 'Home2 Suites by Hilton Cartersville',
      timesheets: { total: 4, onTime: 2, late: 1, pending: 1 },
      punches: { total: 16, onTime: 10, percentage: 62.5, level: 'RED' },
      avgDaysLate: 5,
    },
  ],
  byManager: [
    {
      hotelId: 'h-cartersville',
      hotelName: 'Home2 Suites by Hilton Cartersville',
      departmentId: 'd-hk',
      departmentName: 'Housekeeping',
      managers: [{ id: 'u-mgr-hk', fullName: 'Mariana Solís' }],
      timesheets: { total: 2, onTime: 1, late: 0, pending: 1 },
      punches: { total: 8, onTime: 8, percentage: 100, level: 'GREEN' },
      avgDaysLate: null,
    },
  ],
}

export function registerSettlementMocks(): void {
  registerMockRoutes([
    {
      method: 'GET',
      path: '/pending-approvals',
      resolve: ({ search }): ApiEnvelope<PendingApprovalWeek[]> => {
        const hotelId = search.get('hotelId')
        const weekStart = search.get('weekStart')
        return {
          data: PENDING_WEEKS.filter(
            (row) =>
              (!hotelId || row.hotelId === hotelId) && (!weekStart || row.weekStart === weekStart),
          ),
        }
      },
    },
    {
      method: 'GET',
      path: '/pending-approvals/timeliness',
      resolve: (): ApiEnvelope<ApprovalTimeliness> => ({ data: TIMELINESS }),
    },
    {
      method: 'GET',
      path: '/consolidations',
      resolve: ({ search }): ApiEnvelope<ConsolidationRow[]> => {
        const weekStart = search.get('weekStart')
        const status = search.get('status')
        const rows = CONSOLIDATIONS.filter(
          (row) =>
            (!weekStart || row.weekStart === weekStart) && (!status || row.status === status),
        )
        return { data: rows.map(summaryOf) }
      },
    },
    {
      method: 'GET',
      path: '/consolidations/:id',
      resolve: (request): ApiEnvelope<ConsolidationDetailed> => ({
        data: structuredClone(findConsolidation(request)),
      }),
    },
    {
      method: 'POST',
      path: '/consolidations/:id/validate',
      resolve: (request) => moveConsolidation(request, 'DRAFT', 'VALIDATED', 'validatedAt'),
    },
    {
      method: 'POST',
      path: '/consolidations/:id/authorize',
      resolve: (request) => moveConsolidation(request, 'VALIDATED', 'AUTHORIZED', 'authorizedAt'),
    },
    {
      method: 'POST',
      path: '/consolidations/:id/pay',
      resolve: (request) => moveConsolidation(request, 'AUTHORIZED', 'PAID', 'paidAt'),
    },
    {
      method: 'GET',
      path: '/invoices',
      resolve: ({ search }): ApiEnvelope<InvoiceRow[]> => {
        const hotelId = search.get('hotelId')
        const status = search.get('status')
        const rows = INVOICES.filter(
          (row) => (!hotelId || row.hotel.id === hotelId) && (!status || row.status === status),
        )
        return { data: rows.map(invoiceSummaryOf) }
      },
    },
    {
      method: 'GET',
      path: '/invoices/:id',
      resolve: (request): ApiEnvelope<InvoiceDetailed> => ({
        data: structuredClone(findInvoice(request)),
      }),
    },
    {
      method: 'POST',
      path: '/invoices/:id/approve',
      resolve: (request) => moveInvoice(request, 'DRAFT', 'APPROVED'),
    },
    {
      method: 'POST',
      path: '/invoices/:id/send',
      resolve: (request) => moveInvoice(request, 'APPROVED', 'SENT'),
    },
    {
      method: 'POST',
      path: '/invoices/:id/pay',
      resolve: (request) => moveInvoice(request, 'SENT', 'PAID'),
    },
  ])
}
