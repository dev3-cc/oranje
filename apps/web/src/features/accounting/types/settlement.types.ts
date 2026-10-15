/**
 * Contrato de `settlement` tal como lo sirve la API (`consolidations` e
 * `invoices`). Los montos llegan como cadena decimal: el dinero no pasa por
 * `number` en el cliente, solo se formatea al pintar.
 */

export interface ConsolidationWorker {
  id: string
  fullName: string
}

export interface ConsolidationDetail {
  id: string
  hotelName: string
  positionName: string
  regularMinutes: number
  overtimeMinutes: number
  payRateApplied: string
  overtimeMultiplierApplied: string
  isInternalRate: boolean
  subtotal: string
}

export interface ConsolidationDeduction {
  id: string
  type: string
  amount: string
  sourceNote: string | null
  refundedAt: string | null
}

/** Una fila de `GET /consolidations`: un colaborador, UN hotel y UNA semana. */
export interface ConsolidationRow {
  id: string
  worker: ConsolidationWorker
  hotel: { id: string; name: string }
  weekStart: string
  weekEnd: string
  status: string
  grossAmount: string
  deductionAmount: string
  netAmount: string
  validatedAt: string | null
  authorizedAt: string | null
  paidAt: string | null
}

/** `GET /consolidations/:id`: la misma fila con sus líneas y deducciones. */
export interface ConsolidationDetailed extends ConsolidationRow {
  details: ConsolidationDetail[]
  deductions: ConsolidationDeduction[]
}

export interface InvoiceDetail {
  id: string
  workerName: string
  positionName: string
  regularMinutes: number
  overtimeMinutes: number
  billRateApplied: string
  overtimeMultiplierApplied: string
  subtotal: string
}

export interface InvoiceRow {
  id: string
  folio: string
  hotel: { id: string; name: string }
  status: string
  periodStart: string
  periodEnd: string
  totalAmount: string
  creditAmount: string
  approvedAt: string | null
  createdAt: string
}

export interface InvoiceDetailed extends InvoiceRow {
  details: InvoiceDetail[]
}

/** Semana cerrada con horas que el Manager de Área no aprobó (`GET /pending-approvals`). */
export interface PendingApprovalWeek {
  hotelId: string
  hotelName: string
  /** Lunes, `AAAA-MM-DD`. */
  weekStart: string
  weekEnd: string
  cutoff: string
  daysLate: number
  pendingTimesheets: number
  responsables: Array<{
    departmentName: string | null
    managers: Array<{ id: string; fullName: string }>
  }>
}
