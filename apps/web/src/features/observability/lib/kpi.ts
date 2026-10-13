import type { MessageDescriptor } from '@lingui/core'

/**
 * El único lugar donde vive una meta (Guía del Observador, regla 3).
 *
 * Las metas salen del tablero maquetado y son **de ejemplo**: ningún documento
 * de Reglas de Negocio las aprobó (Guía §6.2). Por eso la tarjeta lo dice. Un
 * KPI sin meta aquí se muestra con «Sin meta» y sin color: jamás se inventa
 * un umbral (regla 4). Por lo mismo, hoy ninguna meta trae banda «En riesgo»:
 * el tablero maquetado no la documenta.
 */

export type KpiId =
  // Ventas
  | 'salesConversion'
  | 'salesLoss'
  | 'salesOnboardingCycle'
  | 'salesStale'
  | 'salesVisits'
  | 'salesMeetings'
  | 'salesHotelsWithoutRequisition'
  // Hotel
  | 'hotelAuthorizeHours'
  | 'hotelLeadTime'
  | 'hotelCancelled'
  | 'hotelApproveHours'
  | 'hotelUnapprovedWeeks'
  | 'hotelStandBy'
  // Reclutamiento
  | 'recruitmentFillRate'
  | 'recruitmentUrgentOpen'
  | 'recruitmentTimeToFill'
  | 'recruitmentPoolIntake'
  | 'recruitmentNoShow'
  // Colaborador
  | 'workerShiftsInProgress'
  | 'workerCompleteShifts'
  | 'workerShortLunch'
  | 'workerLongLunch'
  | 'workerSameMinute'
  | 'workerShortShifts'
  | 'workerOutsideGeofence'
  | 'workerManual'
  | 'workerPunctuality'
  | 'workerBlacklist'
  | 'workerCompleteProfile'
  // Inspección
  | 'inspectionOpenAccidents'

export type KpiFormat = 'percent' | 'count' | 'hours' | 'days'

/**
 * Por qué no hay número (Guía, regla 5: no mezclar los vacíos).
 * - `NO_SOURCE`: el cálculo existe, falta el dato de entrada (la puntualidad).
 * - `NO_DATA`: hay fuente, pero el periodo no trae nada que medir.
 */
export type KpiEmpty = 'NO_SOURCE' | 'NO_DATA'

/** Qué ventana mide: el periodo elegido, la foto de ahora, o todo el histórico. */
export type KpiScope = 'PERIOD' | 'NOW' | 'ALL_TIME'

export interface Kpi {
  id: KpiId
  label: MessageDescriptor
  /** Cómo se calcula, en una línea para quien lo lee. */
  hint: MessageDescriptor
  format: KpiFormat
  scope: KpiScope
  value: number | null
  empty?: KpiEmpty
  /** «3 de 15»: de dónde sale un porcentaje. */
  ratio?: { part: number; whole: number }
  /** El cálculo es una aproximación; la tarjeta lo dice. */
  approximate?: boolean
}

export interface KpiTarget {
  /** `atLeast`: más es mejor. `atMost`: menos es mejor. */
  direction: 'atLeast' | 'atMost'
  value: number
  /** Del tablero maquetado, no aprobada. Hoy todas lo son. */
  isExample: boolean
}

/** Los porcentajes como fracción (`0.2` = 20%), igual que `formatPercent`. */
export const KPI_TARGETS: Partial<Record<KpiId, KpiTarget>> = {
  salesConversion: { direction: 'atLeast', value: 0.2, isExample: true },
  salesVisits: { direction: 'atLeast', value: 8, isExample: true },
  salesMeetings: { direction: 'atLeast', value: 12, isExample: true },
  salesHotelsWithoutRequisition: { direction: 'atMost', value: 0, isExample: true },

  hotelApproveHours: { direction: 'atMost', value: 48, isExample: true },
  hotelUnapprovedWeeks: { direction: 'atMost', value: 0, isExample: true },
  hotelLeadTime: { direction: 'atLeast', value: 5, isExample: true },
  hotelCancelled: { direction: 'atMost', value: 0.1, isExample: true },

  recruitmentFillRate: { direction: 'atLeast', value: 0.9, isExample: true },
  recruitmentTimeToFill: { direction: 'atMost', value: 7, isExample: true },
  recruitmentNoShow: { direction: 'atMost', value: 0.05, isExample: true },

  workerCompleteShifts: { direction: 'atLeast', value: 0.98, isExample: true },
  workerShortLunch: { direction: 'atMost', value: 0, isExample: true },
  workerOutsideGeofence: { direction: 'atMost', value: 0, isExample: true },

  inspectionOpenAccidents: { direction: 'atMost', value: 3, isExample: true },
}

/**
 * La escala propia del tablero (Guía §4.4): no es un semáforo del vault y no
 * usa sus tokens `st-*`, para no romper «un color = un significado».
 */
export type KpiStatus = 'ON_TARGET' | 'OFF_TARGET' | 'NO_TARGET' | 'NO_DATA'

export function kpiStatus(kpi: Pick<Kpi, 'id' | 'value'>): KpiStatus {
  if (kpi.value === null) return 'NO_DATA'
  const target = KPI_TARGETS[kpi.id]
  if (!target) return 'NO_TARGET'
  const meets =
    target.direction === 'atLeast' ? kpi.value >= target.value : kpi.value <= target.value
  return meets ? 'ON_TARGET' : 'OFF_TARGET'
}

export const KPI_STATUS_CLASS: Record<KpiStatus, { chip: string; card: string }> = {
  ON_TARGET: { chip: 'bg-green/15 text-ink', card: 'border-green/40' },
  OFF_TARGET: { chip: 'bg-red/10 text-ink', card: 'border-red/40' },
  NO_TARGET: { chip: 'bg-surface-3 text-ink-2', card: 'border-line' },
  NO_DATA: { chip: 'bg-surface-3 text-ink-3', card: 'border-line' },
}

export function ratioOf(part: number, whole: number): Pick<Kpi, 'value' | 'ratio' | 'empty'> {
  if (whole === 0) return { value: null, empty: 'NO_DATA' }
  return { value: part / whole, ratio: { part, whole } }
}

export function averageOf(values: number[]): Pick<Kpi, 'value' | 'empty'> {
  if (values.length === 0) return { value: null, empty: 'NO_DATA' }
  return { value: values.reduce((sum, value) => sum + value, 0) / values.length }
}
