import type { ContractStatus } from '@/shared/constants/contractStatus'
import type { GeoPoint } from '@/shared/types/geo.types'

/**
 * Formas de respuesta de Clientes Activos (`commercial.vw_client`).
 *
 * La vista NO trae contrato ni zona: el número, su estado, las posiciones y el
 * rango de tarifas salen de unir con `commercial.contract` y `contract_rate`;
 * la zona, de `catalogs.zone`. Por eso `contract` es un objeto aparte y puede
 * venir nulo — un hotel puede estar activado y quedarse sin contrato vigente.
 *
 * ⚠ Igual que las demás, su lugar es `packages/contracts` (§5).
 */
export interface ClientContractSummary {
  /** El id del contrato, no el del hotel: es a donde apunta «Ver detalle». */
  id: string
  number: string
  status: ContractStatus
  positionCount: number
  /** Extremos de `contract_rate`: el rango que se le factura al hotel. */
  minRate: number
  maxRate: number
}

export interface ClientCard {
  id: string
  /**
   * El id del prospecto de este hotel. Un cliente es un prospecto que llegó a
   * `NARANJA`, así que su ficha es la MISMA del Pipeline —no una pantalla
   * paralela— y es a donde lleva «Ver detalle».
   */
  prospectId: string
  hotelName: string
  zoneName: string
  /** `activated_at`: el día que el hotel dejó de ser prospecto. ISO sin hora. */
  activatedAt: string
  /** Zona horaria del hotel, tal como se guarda: `América/Cancún`. */
  timezone: string
  /** Radio de la geocerca en metros. Define dónde vale checar entrada. */
  geofenceRadiusM: number
  location: GeoPoint
  /** `null` cuando el hotel no tiene ningún contrato: se activó y se quedó sin él. */
  contract: ClientContractSummary | null
}

export interface ClientPortfolio {
  items: ClientCard[]
  /**
   * Cuántos hoteles hay en cartera, no cuántos se están pintando. Es agregado
   * del backend: la lista es una página y el encabezado habla del total.
   */
  total: number
  /** Las zonas y los años que existen, para armar los filtros sin deducirlos de las filas. */
  zoneNames: string[]
  activationYears: number[]
}

/** Cómo se ordena la cartera. */
export const CLIENT_SORTS = ['RECENT', 'OLDEST', 'NAME'] as const

export type ClientSort = (typeof CLIENT_SORTS)[number]

export const CLIENT_SORT_LABEL: Record<ClientSort, string> = {
  RECENT: 'más reciente',
  OLDEST: 'más antiguo',
  NAME: 'nombre A–Z',
}

/** Ningún filtro puesto en esa columna. */
export const ANY_VALUE = 'ALL'

export interface ClientFilters {
  search: string
  zoneName: string
  contractStatus: ContractStatus | typeof ANY_VALUE
  /** Año de `activated_at`, o `ALL`. Va como texto porque sale de un `<select>`. */
  activationYear: string
  sort: ClientSort
}
