import type { StatusLightToken } from '@oranje/ui'

/**
 * Estado de `commercial.contract`.
 *
 * NO es un semáforo del vault: son los valores del enum de la tabla. El
 * código viaja en inglés (D-11) y lo que lee la persona va en español —
 * esta constante es el único lugar donde se traduce.
 */
export const CONTRACT_STATUSES = ['DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELLED'] as const

export type ContractStatus = (typeof CONTRACT_STATUSES)[number]

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activo',
  EXPIRED: 'Expirado',
  CANCELLED: 'Cancelado',
}

export const CONTRACT_STATUS_TOKEN: Record<ContractStatus, StatusLightToken> = {
  DRAFT: 'st-gris',
  ACTIVE: 'st-verde',
  EXPIRED: 'st-amarillo',
  CANCELLED: 'st-rojo',
}

/**
 * Ventana de aviso por omisión, en días.
 *
 * Es cuánto antes se empieza a advertir que un contrato vence: dentro de la
 * ventana el pie de la vigencia pasa de «10 meses restantes» a «vence en 45
 * días» y se destaca. Sin filtro de vencimiento puesto, los contratos lejanos
 * siguen a la vista y esta ventana solo decide a cuáles hay que hacerles caso.
 */
export const EXPIRY_WARNING_DAYS = 90

/**
 * Los plazos del filtro «Vencimiento». Elegir uno SÍ recorta la lista a los
 * que vencen dentro de esos días, y ese mismo plazo pasa a ser la ventana de
 * aviso de los renglones que quedan.
 */
export const EXPIRY_WINDOWS = [30, 60, 90, 180] as const

/**
 * Los días de la semana como los numera `week_start_day` / `week_end_day`:
 * domingo es 0. Un contrato de lunes a domingo se guarda como 1 → 0.
 */
export const WEEK_DAY_NAMES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const
