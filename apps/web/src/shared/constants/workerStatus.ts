import type { StatusLightToken } from '@oranje/ui'

/**
 * Semáforo de Colaborador: en qué situación está una persona del pool.
 *
 * ⚠ DERIVADO DE LA CAPTURA, NO DEL VAULT.
 *
 * `NOMENCLATURA.md` §5 declara `packages/domain/src/semaforos/semaforoColaborador.ts`
 * pero solo transcribe el ejemplo del de Requisición, así que estos seis
 * estados y sus etiquetas salen de la maqueta del Pool. Antes de darlos por
 * buenos tienen que validarse contra la nota del semáforo y pasar por
 * `semaforo-guardian`. Las TRANSICIONES no se declaran aquí a propósito:
 * inventarlas sería peor que no tenerlas, porque alguna capa acabaría usándolas.
 *
 * ⚠ Y LOS CÓDIGOS ESTÁN EN INGLÉS.
 *
 * Los otros dos semáforos nombran el color en español —`VERDE_MANZANA`—, y el
 * ejemplo de §5 usa justamente ese. Este llega de la maqueta con
 * `STRONG_GREEN`, `PINK`, `BROWN`, y la columna se llama `status_light_code`.
 * Se transcribe tal cual porque es lo que se ve, pero uno de los dos idiomas
 * está mal y conviene resolverlo antes de que existan filas guardadas.
 *
 * ⚠ Su sitio es `packages/domain`, hoy fuera del alcance acordado.
 */
export const WORKER_STATUSES = [
  'STRONG_GREEN',
  'ORANGE',
  'YELLOW',
  'WHITE',
  'PINK',
  'BROWN',
] as const

export type WorkerStatus = (typeof WORKER_STATUSES)[number]

/** Qué significa el color EN ESTE semáforo. En otro dice otra cosa. */
export const WORKER_STATUS_LABEL: Record<WorkerStatus, string> = {
  STRONG_GREEN: 'Disponible',
  ORANGE: 'Fijo',
  YELLOW: 'Disp. voluntario',
  WHITE: 'Pre-asignación',
  PINK: 'Stand-by',
  BROWN: 'Asig. temporal',
}

export const WORKER_STATUS_TOKEN: Record<WorkerStatus, StatusLightToken> = {
  STRONG_GREEN: 'st-verde',
  ORANGE: 'st-naranja',
  YELLOW: 'st-amarillo',
  WHITE: 'st-blanco',
  PINK: 'st-rosa',
  BROWN: 'st-cafe',
}

/**
 * El chip enseña el código Y su significado: `STRONG_GREEN · Disponible`.
 *
 * El código porque es el valor que viaja en la API y el que aparece en los
 * filtros; el significado porque nadie tiene por qué saber de memoria que
 * `BROWN` es una asignación temporal.
 */
export function workerStatusChipLabel(status: WorkerStatus): string {
  return `${status} · ${WORKER_STATUS_LABEL[status]}`
}
