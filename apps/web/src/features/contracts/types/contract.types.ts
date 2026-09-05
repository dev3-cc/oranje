import type { ContractStatus } from '@/shared/constants/contractStatus'

/**
 * Formas de respuesta de Documentos T&C (`commercial.contract`).
 *
 * ⚠ Igual que las demás, su lugar es `packages/contracts` (§5), hoy fuera del
 * alcance acordado.
 */

export interface ContractRow {
  id: string
  /** Folio del documento: `CT-2026-0184`. Único en la tabla. */
  number: string
  hotelName: string
  /** Para el filtro de zona; no se pinta en la tabla. */
  zoneName: string
  status: ContractStatus
  /** ISO sin hora. `null` en un borrador que todavía no tiene vigencia. */
  validFrom: string | null
  /** `null` = indefinido, que NO es lo mismo que sin vigencia. */
  validTo: string | null
  /**
   * Qué parte del periodo ya se consumió, 0–1. Lo calcula el BACKEND: depende
   * del día de hoy, y si lo dedujera el front la barra avanzaría según cuándo
   * se abrió la pestaña. `null` cuando no hay periodo que consumir.
   */
  elapsed: number | null
  /**
   * Días que faltan para `valid_to`. Backend, por lo mismo. `null` cuando no
   * hay vigencia o es indefinida; negativo si ya pasó.
   */
  daysRemaining: number | null
  positionCount: number
  /** Lo que se le FACTURA al hotel; el par que se paga vive en el detalle. */
  overtimeBillMultiplier: number | null
  holidayBillMultiplier: number | null
}

export interface ContractList {
  items: ContractRow[]
  /** Las zonas que existen, para armar el filtro sin inventarlas de las filas. */
  zoneNames: string[]
}

/** Ningún filtro puesto en esa columna. Va como valor y no como ausencia para que el `<select>` tenga qué seleccionar. */
export const ANY_VALUE = 'ALL'

export interface ContractListFilters {
  search: string
  status: ContractStatus | typeof ANY_VALUE
  /** El nombre de la zona, o `ALL`. Es `string` porque las zonas se cargan del backend. */
  zoneName: string
  /**
   * Solo los que vencen dentro de N días; `null` = todos. Un contrato
   * indefinido, sin vigencia o ya vencido no «vence en» ningún plazo, así que
   * con el filtro puesto queda fuera.
   */
  expiresInDays: number | null
}

/** Lo que se paga y lo que se factura para un mismo concepto. */
export interface ContractMultiplier {
  pay: number
  bill: number
}

export interface ContractRate {
  id: string
  /** Posición del catálogo: `Housekeeper`, `Chef`… */
  positionName: string
  payRate: number
  billRate: number
}

export interface ContractDetail {
  id: string
  number: string
  hotelName: string
  status: ContractStatus
  signedByName: string
  /** ISO sin hora. */
  signedAt: string
  validFrom: string
  /** `null` = indefinido. */
  validTo: string | null
  /** 0 = domingo. Un contrato de lunes a domingo es 1 → 0. */
  weekStartDay: number
  weekEndDay: number
  multipliers: {
    overtime: ContractMultiplier
    holiday: ContractMultiplier
  }
  /** Una fila por posición del catálogo (`commercial.contract_rate`). */
  rates: ContractRate[]
}
