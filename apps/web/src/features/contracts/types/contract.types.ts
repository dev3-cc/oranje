import type { ContractStatus } from '@/shared/constants/contractStatus'

/**
 * Formas de respuesta de Contratos (`commercial.contract`).
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
  /** La foto de Places del hotel (D-34): es lo que distingue una tarjeta de otra. */
  hotelPhotoUrl: string | null
  /** La tarifa de facturación más baja del cuadro, para el «desde» de la tarjeta. */
  minBillRate: number | null
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
  /** El puesto del catálogo, para poder copiar el cuadro al renovar. */
  catalogPositionId: string
  /** Posición del catálogo: `Housekeeper`, `Chef`… */
  positionName: string
  payRate: number
  billRate: number
}

export interface ContractDetail {
  id: string
  number: string
  hotelId: string
  hotelName: string
  /** Dirección del hotel para el acuerdo imprimible; `null` si no se pudo leer. */
  hotelAddress: string | null
  status: ContractStatus
  /** Quién lo activó (el BDC); `null` si nunca se activó. El hotel firma fuera. */
  signedByName: string | null
  /** Cuándo se activó; `null` en un borrador. */
  signedAt: string | null
  /** Enviado al hotel (Hugo, 2026-10-23): un borrador enviado queda bloqueado. */
  sentAt: string | null
  sentByName: string | null
  createdAt: string
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
  /** 0 = no se descuenta. Antes era un sí/no con "3 USD" fijo en el texto
      (Hugo, 2026-10-21): ahora el monto es el dato real, editable. */
  mealDeductionAmount: number
  splitsInvoiceByMonth: boolean
  /** Una fila por posición del catálogo (`commercial.contract_rate`). */
  rates: ContractRate[]
  /** `null` si nunca se editó desde que se creó. Lo usa la vista previa de
      pago para avisar «esto cambió» sobre una semana ya aprobada. */
  updatedAt: string | null
  /** De qué Propuesta (versión exacta) nace, para enlazar a
      `/proposals/:prospectId/:version` (Hugo, 2026-10-21). `null` en
      contratos heredados/migrados. */
  proposal: { id: string; prospectId: string; version: number } | null
  /** Campos del machote del Service Agreement (Hugo, 2026-10-20): se
      prellenan desde la última propuesta enviada pero son editables. */
  propertyName: string | null
  propertyAddress: string | null
  companyEmail: string | null
  /** Hoy fijos en código si vienen `null`: "Orange Solutions & Operations, LLC" / irene@oranjepeople.com. */
  serviceProviderName: string | null
  serviceProviderEmail: string | null
  /** Candado (Hugo, 2026-10-21; ampliado a los enviados el 2026-10-23):
      "bloqueado" es ACTIVO o Borrador ya enviado, con `!isUnlocked`. Nunca
      cambia el status. */
  isUnlocked: boolean
}

/**
 * Lo que ve Reclutamiento al asignar un slot (Hugo, 2026-09-22): solo el
 * pago, nunca la factura al hotel — eso sigue siendo de Ventas. `null` es
 * honesto en dos casos: el hotel no tiene contrato activo, o el contrato no
 * cotizó esa posición.
 */
export interface PositionPayRate {
  payRate: number
  contractNumber: string
}
