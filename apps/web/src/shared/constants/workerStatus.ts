import type { StatusLightToken } from '@oranje/ui'

import { IS_DEV_UI } from '@/shared/lib/devMode'

/**
 * Semáforo del Colaborador: los 12 estados del seed real
 * (`apps/api/prisma/seed.ts`, semáforo WORKER). Un cambio allá obliga a
 * cambiar aquí. Las TRANSICIONES no se declaran a propósito: viajan por la
 * API (`GET /workers/:id/transitions`), ya filtradas por rol.
 *
 * ⚠ Su sitio es `packages/domain`, hoy fuera del alcance acordado.
 */
export const WORKER_STATUSES = [
  'WHITE',
  'APPLE_GREEN',
  'LIGHT_BLUE',
  'ORANGE',
  'STRONG_GREEN',
  'YELLOW',
  'BROWN',
  'PINK',
  'PURPLE',
  'RED',
  'GRAY',
  'BLACK',
] as const

export type WorkerStatus = (typeof WORKER_STATUSES)[number]

/** Qué significa el color EN ESTE semáforo. En otro dice otra cosa. */
export const WORKER_STATUS_LABEL: Record<WorkerStatus, string> = {
  WHITE: 'Pre-asignación',
  APPLE_GREEN: 'Día 1-2',
  LIGHT_BLUE: 'Día 3+',
  ORANGE: 'Fijo',
  STRONG_GREEN: 'Disponible',
  YELLOW: 'Disp. voluntario',
  BROWN: 'Asig. temporal',
  PINK: 'Stand-by',
  PURPLE: 'No regresó',
  RED: 'Reportado',
  GRAY: 'Accidentado',
  BLACK: 'Blacklist',
}

export const WORKER_STATUS_TOKEN: Record<WorkerStatus, StatusLightToken> = {
  WHITE: 'st-blanco',
  APPLE_GREEN: 'st-verde-manzana',
  LIGHT_BLUE: 'st-azul-claro',
  ORANGE: 'st-naranja',
  STRONG_GREEN: 'st-verde',
  YELLOW: 'st-amarillo',
  BROWN: 'st-cafe',
  PINK: 'st-rosa',
  PURPLE: 'st-morado',
  RED: 'st-rojo',
  GRAY: 'st-gris',
  BLACK: 'st-negro',
}

/**
 * El chip enseña el código Y su significado: `STRONG_GREEN · Disponible`.
 *
 * El código porque es el valor que viaja en la API y el que aparece en los
 * filtros; el significado porque nadie tiene por qué saber de memoria que
 * `BROWN` es una asignación temporal.
 */
export function workerStatusChipLabel(status: WorkerStatus): string {
  /** En dev el código acompaña (documentación viva); en build el color ya es el estado. */
  return IS_DEV_UI ? `${status} · ${WORKER_STATUS_LABEL[status]}` : WORKER_STATUS_LABEL[status]
}
