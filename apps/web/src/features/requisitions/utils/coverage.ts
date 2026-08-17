import type { StatusLightToken } from '@oranje/ui'

import type { RequisitionCoverage } from '../types/requisition.types'

/**
 * Cómo se lee una cobertura: la palabra, el color y el porcentaje.
 *
 * Vive aquí y no en cada componente porque el tablero y el detalle la pintan
 * distinto —barra allá, chip acá— pero tienen que llamarle igual a lo mismo: si
 * una pantalla dice «parcial» y la otra «incompleta», parecen dos conceptos.
 */
export interface CoverageDescription {
  label: string
  token: StatusLightToken
  /** 0–100, ya redondeable para el ancho de la barra. */
  percent: number
}

export function describeCoverage(coverage: RequisitionCoverage): CoverageDescription {
  const isComplete = coverage.total > 0 && coverage.filled >= coverage.total
  const isEmpty = coverage.filled === 0
  const percent = coverage.total > 0 ? (coverage.filled / coverage.total) * 100 : 0

  if (isComplete) return { label: 'cubierta', token: 'st-verde', percent }
  // Sin cubrir es rojo y no amarillo: cero asignados no es «va a medias», es que
  // no ha empezado, y el tablero necesita distinguirlos de un vistazo.
  if (isEmpty) return { label: 'sin cubrir', token: 'st-rojo', percent }
  return { label: 'parcial', token: 'st-amarillo', percent }
}
