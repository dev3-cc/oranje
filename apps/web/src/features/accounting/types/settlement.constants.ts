import { msg } from '@lingui/core/macro'
import type { StatusLightToken } from '@oranje/ui'

import { labelMap } from '@/shared/lib/i18nLabels'

/**
 * Semáforo del Consolidado Semanal (vault: Core/Módulos/Semáforos/Semáforo del
 * Consolidado Semanal.md). Los códigos son los de la API; los nombres, los del vault.
 */
export const CONSOLIDATION_STATUSES = ['DRAFT', 'VALIDATED', 'AUTHORIZED', 'PAID'] as const
export type ConsolidationStatus = (typeof CONSOLIDATION_STATUSES)[number]

const CONSOLIDATION_STATUS_MESSAGE = {
  DRAFT: msg`Borrador`,
  VALIDATED: msg`Revisado`,
  AUTHORIZED: msg`Autorizado`,
  PAID: msg`Pagado`,
}

export const CONSOLIDATION_STATUS_LABEL: Record<ConsolidationStatus, string> = labelMap(
  CONSOLIDATION_STATUS_MESSAGE,
)

export const CONSOLIDATION_STATUS_TOKEN: Record<ConsolidationStatus, StatusLightToken> = {
  DRAFT: 'st-gris',
  VALIDATED: 'st-azul-claro',
  AUTHORIZED: 'st-naranja',
  PAID: 'st-verde',
}

/**
 * Semáforo de la Factura al Hotel (vault: Semáforo de la Factura al Hotel.md).
 * La API tiene además APPROVED: el Manager la aprueba antes de enviarla
 * (RR-CO-21) y el vault no le da estado propio. DRAFT es el borrador que esa
 * aprobación recibe; lo ven la Contadora y el Manager.
 */
export const INVOICE_STATUSES = ['DRAFT', 'APPROVED', 'SENT', 'PAID'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

const INVOICE_STATUS_MESSAGE = {
  DRAFT: msg`Pendiente de aprobación`,
  APPROVED: msg`Aprobada, sin enviar`,
  SENT: msg`Emitida`,
  PAID: msg`Pagada`,
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = labelMap(INVOICE_STATUS_MESSAGE)

export const INVOICE_STATUS_TOKEN: Record<InvoiceStatus, StatusLightToken> = {
  DRAFT: 'st-gris',
  APPROVED: 'st-azul-claro',
  SENT: 'st-naranja',
  PAID: 'st-verde',
}

/** Tipos de `settlement.deduction` (`ck_deduction_type`). */
const DEDUCTION_TYPE_MESSAGE = {
  UNIFORM: msg`Uniforme`,
  MEALS: msg`Comida`,
  TAX_RETENTION: msg`Retención del 16%`,
}

const DEDUCTION_TYPE_LABEL: Record<string, string> = labelMap(DEDUCTION_TYPE_MESSAGE)

/** El código del tipo nunca se pinta: sin etiqueta conocida, va el texto de respaldo. */
export function deductionLabel(code: string, fallback: string): string {
  return DEDUCTION_TYPE_LABEL[code] ?? fallback
}
