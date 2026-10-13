import type {
  AccountingTimelineRow,
  AccountingTimesheetTimeline,
} from '../types/accountingTimeline.types'
import type {
  ConsolidationDetailed,
  ConsolidationRow,
  InvoiceDetailed,
  InvoiceRow,
  PendingApprovalWeek,
} from '../types/settlement.types'

import { registerSettlementMocks } from './settlementMocks'

import { baseApi } from '@/app/baseApi'
// La cinta de días de Contabilidad arma la suya con estas mismas piezas del
// staff (el índice de requisiciones y el día→entry), en vez de tocar su
// pantalla (Hugo, 2026-10-08): son funciones puras, no la UI.
// eslint-disable-next-line no-restricted-imports
import {
  fetchRequisitionIndex,
  requisitionRefOf,
  toEntry,
} from '@/features/timesheet/api/timesheetApi'
// eslint-disable-next-line no-restricted-imports
import { registerTimesheetMocks } from '@/features/timesheet/api/timesheetMocks'
// eslint-disable-next-line no-restricted-imports
import { addDaysIso } from '@/features/timesheet/lib/weekNavigation'
import { fetchAllPages } from '@/shared/lib/fetchAllPages'
import type { ApiEnvelope, HotelApi, TimesheetApi } from '@/shared/types/apiContract.types'
import type { ApprovalTimeliness } from '@/shared/types/approvalTimeliness.types'

/* Contabilidad: consolidados (payroll), facturas al hotel y el Timesheet de
   todos los hoteles. Los mocks del módulo viven aquí para que el modo mock
   funcione sin el API; `/timesheets` lo mockea su módulo dueño. */
registerSettlementMocks()
registerTimesheetMocks()

const MS_PER_DAY = 86_400_000

type FetchWithBQ = (
  args: string | { url: string; method?: string; body?: unknown; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

export interface ConsolidationFilters {
  /** Lunes de la semana, `AAAA-MM-DD`. Sin valor: todas las semanas. */
  weekStart?: string
  status?: string
}

export interface InvoiceFilters {
  hotelId?: string
  status?: string
}

export interface AccountingTimesheetFilters {
  status?: string
  /** Lunes de la semana, `AAAA-MM-DD`. */
  weekStart?: string
  hotelId?: string
}

export interface SetPayOverrideRequest {
  id: string
  regularMinutes: number
  overtimeMinutes: number
  payRate: number
  reason: string
}

export interface ClientHotelOption {
  id: string
  name: string
}

/** Sin claves vacías: la API no distingue `status=""` de no mandarlo. */
function compact(params: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') out[key] = value
  }
  return out
}

const CONSOLIDATION_TAG = { type: 'WeeklyConsolidation' as const, id: 'LIST' }
const INVOICE_TAG = { type: 'Invoice' as const, id: 'LIST' }
const TIMESHEET_LIST_TAG = { type: 'Timesheet' as const, id: 'LIST' }

export const settlementApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getConsolidations: build.query<ConsolidationRow[], ConsolidationFilters | void>({
      query: (filters) => ({
        url: '/consolidations',
        params: compact({ weekStart: filters?.weekStart, status: filters?.status }),
      }),
      transformResponse: (raw: ApiEnvelope<ConsolidationRow[]>) => raw.data,
      providesTags: [CONSOLIDATION_TAG],
    }),

    getConsolidation: build.query<ConsolidationDetailed, string>({
      query: (id) => `/consolidations/${id}`,
      transformResponse: (raw: ApiEnvelope<ConsolidationDetailed>) => raw.data,
      providesTags: (_res, _err, id) => [{ type: 'WeeklyConsolidation' as const, id }],
    }),

    validateConsolidation: build.mutation<ConsolidationDetailed, string>({
      query: (id) => ({ url: `/consolidations/${id}/validate`, method: 'POST' }),
      transformResponse: (raw: ApiEnvelope<ConsolidationDetailed>) => raw.data,
      invalidatesTags: (_res, _err, id) => [
        CONSOLIDATION_TAG,
        { type: 'WeeklyConsolidation' as const, id },
      ],
    }),

    authorizeConsolidation: build.mutation<ConsolidationDetailed, string>({
      query: (id) => ({ url: `/consolidations/${id}/authorize`, method: 'POST' }),
      transformResponse: (raw: ApiEnvelope<ConsolidationDetailed>) => raw.data,
      invalidatesTags: (_res, _err, id) => [
        CONSOLIDATION_TAG,
        { type: 'WeeklyConsolidation' as const, id },
      ],
    }),

    payConsolidation: build.mutation<ConsolidationDetailed, string>({
      query: (id) => ({ url: `/consolidations/${id}/pay`, method: 'POST' }),
      transformResponse: (raw: ApiEnvelope<ConsolidationDetailed>) => raw.data,
      invalidatesTags: (_res, _err, id) => [
        CONSOLIDATION_TAG,
        { type: 'WeeklyConsolidation' as const, id },
      ],
    }),

    getInvoices: build.query<InvoiceRow[], InvoiceFilters | void>({
      query: (filters) => ({
        url: '/invoices',
        params: compact({ hotelId: filters?.hotelId, status: filters?.status }),
      }),
      transformResponse: (raw: ApiEnvelope<InvoiceRow[]>) => raw.data,
      providesTags: [INVOICE_TAG],
    }),

    getInvoice: build.query<InvoiceDetailed, string>({
      query: (id) => `/invoices/${id}`,
      transformResponse: (raw: ApiEnvelope<InvoiceDetailed>) => raw.data,
      providesTags: (_res, _err, id) => [{ type: 'Invoice' as const, id }],
    }),

    approveInvoice: build.mutation<InvoiceDetailed, string>({
      query: (id) => ({ url: `/invoices/${id}/approve`, method: 'POST' }),
      transformResponse: (raw: ApiEnvelope<InvoiceDetailed>) => raw.data,
      invalidatesTags: (_res, _err, id) => [INVOICE_TAG, { type: 'Invoice' as const, id }],
    }),

    /* El API solo cambia el estado a SENT; no manda ningún correo. */
    markInvoiceSent: build.mutation<InvoiceDetailed, string>({
      query: (id) => ({ url: `/invoices/${id}/send`, method: 'POST' }),
      transformResponse: (raw: ApiEnvelope<InvoiceDetailed>) => raw.data,
      invalidatesTags: (_res, _err, id) => [INVOICE_TAG, { type: 'Invoice' as const, id }],
    }),

    payInvoice: build.mutation<InvoiceDetailed, string>({
      query: (id) => ({ url: `/invoices/${id}/pay`, method: 'POST' }),
      transformResponse: (raw: ApiEnvelope<InvoiceDetailed>) => raw.data,
      invalidatesTags: (_res, _err, id) => [INVOICE_TAG, { type: 'Invoice' as const, id }],
    }),

    /** Hoteles cliente para el filtro de facturas (`/hotels` ya viene paginado). */
    getClientHotelOptions: build.query<ClientHotelOption[], void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const res = await fetchAllPages<HotelApi>(fetchWithBQ as FetchWithBQ, '/hotels', {
          onlyClients: true,
        })
        if ('error' in res) return { error: res.error as never }
        return { data: res.data.map((hotel) => ({ id: hotel.id, name: hotel.name })) }
      },
    }),

    /** Semanas cerradas con horas sin aprobar. Solo lectura: no hay etiqueta que invalidar. */
    getPendingApprovals: build.query<
      PendingApprovalWeek[],
      { hotelId?: string; weekStart?: string } | void
    >({
      query: (filters) => ({
        url: '/pending-approvals',
        params: compact({ hotelId: filters?.hotelId, weekStart: filters?.weekStart }),
      }),
      transformResponse: (raw: ApiEnvelope<PendingApprovalWeek[]>) => raw.data,
    }),

    /** KPI 4, la misma fuente que Observabilidad. */
    getApprovalTimeliness: build.query<ApprovalTimeliness, void>({
      query: () => '/pending-approvals/timeliness',
      transformResponse: (raw: ApiEnvelope<ApprovalTimeliness>) => raw.data,
    }),

    /** El Timesheet de todos los hoteles, con el filtro de semana y hotel. */
    getAccountingTimesheets: build.query<TimesheetApi[], AccountingTimesheetFilters | void>({
      query: (filters) => ({
        url: '/timesheets',
        params: compact({
          status: filters?.status,
          weekStart: filters?.weekStart,
          hotelId: filters?.hotelId,
        }),
      }),
      transformResponse: (raw: ApiEnvelope<TimesheetApi[]>) => raw.data,
      providesTags: [TIMESHEET_LIST_TAG],
    }),

    /**
     * La cinta de días de Contabilidad: TODAS las semanas cargadas de una
     * vez, fusionadas por persona × requisición — la misma forma que la
     * cinta del staff (D-28), más la vista previa de pago por semana que el
     * staff no necesita. Propia a propósito: no toca `timesheet/`, solo
     * reusa sus funciones puras de conversión (Hugo, 2026-10-08).
     */
    getAccountingTimesheetTimeline: build.query<
      AccountingTimesheetTimeline,
      { status?: string } | void
    >({
      queryFn: async (filters, _api, _extra, fetchWithBQRaw) => {
        const fetchWithBQ = fetchWithBQRaw as FetchWithBQ
        const listRes = await fetchWithBQ({
          url: '/timesheets',
          params: compact({ status: filters?.status }),
        })
        if ('error' in listRes) return { error: listRes.error as never }
        const timesheets = (listRes.data as ApiEnvelope<TimesheetApi[]>).data

        if (timesheets.length === 0) {
          return { data: { days: [], rows: [], availableWeeks: [] } }
        }

        const requisitionIndex = await fetchRequisitionIndex(fetchWithBQ)

        const availableWeeks = [...new Set(timesheets.map((sheet) => sheet.weekStart))].sort()
        const firstWeek = availableWeeks[0] as string
        const lastWeek = availableWeeks[availableWeeks.length - 1] as string
        const totalDays =
          Math.round(
            (Date.parse(`${lastWeek}T00:00:00Z`) - Date.parse(`${firstWeek}T00:00:00Z`)) /
              MS_PER_DAY,
          ) + 7
        const days = Array.from({ length: totalDays }, (_item, index) =>
          addDaysIso(firstWeek, index),
        )

        const details = await Promise.all(
          timesheets.map((sheet) => fetchWithBQ(`/timesheets/${sheet.id}`)),
        )

        const rows = new Map<string, AccountingTimelineRow>()
        for (const [index, sheet] of timesheets.entries()) {
          const detailRes = details[index]
          if (!detailRes || detailRes.error) continue
          const detail = (detailRes.data as ApiEnvelope<TimesheetApi>).data
          const requisitionInfo = requisitionIndex.get(sheet.requisitionId)
          const requisitionRef =
            sheet.requisitionFolio ?? requisitionRefOf(requisitionIndex, sheet.requisitionId)

          const key = `${sheet.worker.id}|${sheet.requisitionId}`
          const row = rows.get(key) ?? {
            workerId: sheet.worker.id,
            requisitionId: sheet.requisitionId,
            assignment: detail.assignment,
            workerName: sheet.worker.fullName,
            hotelName: sheet.hotel?.name ?? requisitionInfo?.hotelName ?? '—',
            requisitionFolio: requisitionRef,
            entries: [],
            byWeek: {},
          }
          row.entries.push(
            ...(detail.days ?? []).map((day) =>
              toEntry(day, requisitionRef, requisitionInfo?.hotelTimeZone),
            ),
          )
          row.byWeek[sheet.weekStart] = {
            timesheetId: sheet.id,
            weekStatus: sheet.status,
            regularMinutes: sheet.payPreview?.regularMinutes ?? 0,
            overtimeMinutes: sheet.payPreview?.overtimeMinutes ?? 0,
            payRate: sheet.payPreview?.payRate ?? null,
            overtimeMultiplier: sheet.payPreview?.overtimeMultiplier ?? null,
            subtotal: sheet.payPreview?.subtotal ?? null,
            isOverridden: sheet.payPreview?.isOverridden ?? false,
            overrideReason: sheet.payPreview?.overrideReason ?? null,
            isInternalRate: sheet.payPreview?.isInternalRate ?? false,
          }
          rows.set(key, row)
        }

        return { data: { days, rows: [...rows.values()], availableWeeks } }
      },
      providesTags: [TIMESHEET_LIST_TAG],
    }),

    /** Corrección de Contabilidad: tarifa y reparto de horas (Hugo, 2026-10-08). */
    setTimesheetPayOverride: build.mutation<TimesheetApi, SetPayOverrideRequest>({
      query: ({ id, ...body }) => ({ url: `/timesheets/${id}/pay-override`, method: 'PUT', body }),
      transformResponse: (raw: ApiEnvelope<TimesheetApi>) => raw.data,
      invalidatesTags: [TIMESHEET_LIST_TAG],
    }),

    /** Vuelve a lo calculado: borra la corrección, no la deja en cero. */
    clearTimesheetPayOverride: build.mutation<TimesheetApi, string>({
      query: (id) => ({ url: `/timesheets/${id}/pay-override`, method: 'DELETE' }),
      transformResponse: (raw: ApiEnvelope<TimesheetApi>) => raw.data,
      invalidatesTags: [TIMESHEET_LIST_TAG],
    }),
  }),
})

export const {
  useGetConsolidationsQuery,
  useGetConsolidationQuery,
  useValidateConsolidationMutation,
  useAuthorizeConsolidationMutation,
  usePayConsolidationMutation,
  useGetInvoicesQuery,
  useGetInvoiceQuery,
  useApproveInvoiceMutation,
  useMarkInvoiceSentMutation,
  usePayInvoiceMutation,
  useGetClientHotelOptionsQuery,
  useGetAccountingTimesheetsQuery,
  useGetAccountingTimesheetTimelineQuery,
  useSetTimesheetPayOverrideMutation,
  useClearTimesheetPayOverrideMutation,
  useGetPendingApprovalsQuery,
  useGetApprovalTimelinessQuery,
} = settlementApi
