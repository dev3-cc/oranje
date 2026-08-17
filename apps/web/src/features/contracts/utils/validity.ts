import type { StatusLightToken } from '@oranje/ui'

import type { ContractRow } from '../types/contract.types'

/** Días que se cuentan por mes al redondear «10 meses restantes». */
const DAYS_PER_MONTH = 30

export interface ValidityDescription {
  /** El pie bajo la barra: «10 meses restantes», «vence en 45 días», «vencido». */
  note: string
  /** Si hay que hacerle caso ahora: el pie se destaca. */
  isUrgent: boolean
  token: StatusLightToken
  /** 0–100 para el ancho de la barra. */
  percent: number
}

/**
 * Cómo se lee la vigencia de un contrato.
 *
 * Los días los manda el backend; aquí solo se decide cómo se dicen. El corte
 * entre «meses restantes» y «vence en N días» es `warningDays`, que el usuario
 * elige en el filtro: cambiarlo no esconde filas, cambia a cuáles se les grita.
 */
export function describeValidity(row: ContractRow, warningDays: number): ValidityDescription {
  const percent = row.elapsed === null ? 0 : Math.min(100, Math.max(0, row.elapsed * 100))

  if (row.status === 'EXPIRED' || (row.daysRemaining !== null && row.daysRemaining < 0)) {
    return { note: 'vencido', isUrgent: false, token: 'st-gris', percent: 100 }
  }

  if (row.validFrom === null) {
    return { note: 'sin vigencia', isUrgent: false, token: 'st-gris', percent: 0 }
  }

  // Vigencia indefinida: hay periodo, pero no hay cuenta regresiva que dar.
  if (row.daysRemaining === null) {
    return { note: 'indefinido', isUrgent: false, token: 'st-verde', percent }
  }

  if (row.daysRemaining <= warningDays) {
    const days = row.daysRemaining === 1 ? '1 día' : `${String(row.daysRemaining)} días`
    return { note: `vence en ${days}`, isUrgent: true, token: 'st-amarillo', percent }
  }

  const months = Math.round(row.daysRemaining / DAYS_PER_MONTH)
  const note = months === 1 ? '1 mes restante' : `${String(months)} meses restantes`
  return { note, isUrgent: false, token: 'st-verde', percent }
}

/**
 * El margen es una resta entre dos números de la misma respuesta: no depende
 * del reloj ni de cuántas filas se pidieron, así que se calcula aquí. Es otra
 * cosa que los agregados del tablero, que sí vienen del backend.
 *
 * Se redondea a dos decimales porque `2.5 - 2.0` en coma flotante no siempre
 * cae redondo y el margen es dinero.
 */
export function marginOf(pay: number, bill: number): number {
  return Math.round((bill - pay) * 100) / 100
}
