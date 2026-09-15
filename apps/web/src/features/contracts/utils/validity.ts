import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
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
 * entre «meses restantes» y «vence en N días» es `warningDays`: la ventana por
 * omisión, o el plazo del filtro «Vencimiento» cuando hay uno puesto (quien
 * pide los que vencen en 180 días quiere verlos contados en días).
 *
 * El `i18n` viene del componente que la llama (D-36).
 */
export function describeValidity(
  row: ContractRow,
  warningDays: number,
  i18n: I18n,
): ValidityDescription {
  const percent = row.elapsed === null ? 0 : Math.min(100, Math.max(0, row.elapsed * 100))

  if (row.status === 'EXPIRED' || (row.daysRemaining !== null && row.daysRemaining < 0)) {
    return { note: i18n._(msg`vencido`), isUrgent: false, token: 'st-gris', percent: 100 }
  }

  if (row.validFrom === null) {
    return { note: i18n._(msg`sin vigencia`), isUrgent: false, token: 'st-gris', percent: 0 }
  }

  // Vigencia indefinida: hay periodo, pero no hay cuenta regresiva que dar.
  if (row.daysRemaining === null) {
    return { note: i18n._(msg`indefinido`), isUrgent: false, token: 'st-verde', percent }
  }

  if (row.daysRemaining <= warningDays) {
    const note =
      row.daysRemaining === 1
        ? i18n._(msg`vence en 1 día`)
        : i18n._(msg`vence en ${String(row.daysRemaining)} días`)
    return { note, isUrgent: true, token: 'st-amarillo', percent }
  }

  const months = Math.round(row.daysRemaining / DAYS_PER_MONTH)
  const note =
    months === 1 ? i18n._(msg`1 mes restante`) : i18n._(msg`${String(months)} meses restantes`)
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
