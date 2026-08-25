import type { StatusLightToken } from '@oranje/ui'

/**
 * Semáforo de Requisición: estados, transiciones válidas y cómo se pintan.
 *
 * Códigos copiados del seed de la API (`apps/api/prisma/seed.ts`, semáforo
 * REQUISITION): identificadores en inglés por D-11, etiquetas en español.
 *
 * ⚠ Mismo domicilio provisional que el de Onboarding: su sitio es
 * `packages/domain/src/statusLights/requisitionStatusLight.ts`, hoy fuera del alcance
 * acordado.
 */
export const REQUISITION_STATUSES = [
  'APPLE_GREEN',
  'GREEN',
  'YELLOW',
  'LIGHT_BLUE',
  'RED',
  'PURPLE',
] as const

export type RequisitionStatus = (typeof REQUISITION_STATUSES)[number]

/** Qué significa cada color EN ESTE semáforo. En otro dice otra cosa. */
export const REQUISITION_STATUS_LABEL: Record<RequisitionStatus, string> = {
  APPLE_GREEN: 'En elaboración',
  GREEN: 'Autorizada',
  YELLOW: 'En proceso',
  LIGHT_BLUE: 'Cubierta totalmente',
  RED: 'Cubierta parcialmente',
  PURPLE: 'Eliminada',
}

export const REQUISITION_STATUS_TOKEN: Record<RequisitionStatus, StatusLightToken> = {
  APPLE_GREEN: 'st-verde-manzana',
  GREEN: 'st-verde',
  YELLOW: 'st-amarillo',
  LIGHT_BLUE: 'st-azul-claro',
  RED: 'st-rojo',
  PURPLE: 'st-morado',
}

/** Transcritas del vault. Cambiarlas exige actualizar antes la nota del semáforo. */
export const REQUISITION_TRANSITIONS: Record<RequisitionStatus, readonly RequisitionStatus[]> = {
  APPLE_GREEN: ['GREEN', 'PURPLE'],
  GREEN: ['YELLOW', 'PURPLE'],
  YELLOW: ['LIGHT_BLUE', 'RED'],
  LIGHT_BLUE: [],
  RED: ['YELLOW'],
  PURPLE: [],
}

/**
 * Semáforo de Urgencia: cuánto falta para que empiece la requisición.
 *
 * Lo calcula el BACKEND a partir de la fecha de inicio; el front solo lo pinta.
 * Si lo calculara aquí, dos pantallas abiertas a distinta hora mostrarían
 * urgencias distintas para la misma requisición.
 *
 * ⚠ El «verde» de ESTE semáforo es `STRONG_GREEN` (Verde fuerte) en el seed,
 * no `GREEN`: los códigos no se comparten entre semáforos.
 */
export const URGENCY_LEVELS = ['RED', 'YELLOW', 'STRONG_GREEN'] as const

export type UrgencyLevel = (typeof URGENCY_LEVELS)[number]

export const URGENCY_LABEL: Record<UrgencyLevel, string> = {
  RED: '< 72 h',
  YELLOW: '72 – 120 h',
  STRONG_GREEN: '> 120 h',
}

export const URGENCY_TOKEN: Record<UrgencyLevel, StatusLightToken> = {
  RED: 'st-rojo',
  YELLOW: 'st-amarillo',
  STRONG_GREEN: 'st-verde',
}

/**
 * El color por su nombre, para cuando hay que nombrarlo en una frase: «las 2
 * posiciones nacen en Rojo». Ahí el chip no sirve porque va dentro del texto.
 */
export const URGENCY_COLOR_NAME: Record<UrgencyLevel, string> = {
  RED: 'Rojo',
  YELLOW: 'Amarillo',
  STRONG_GREEN: 'Verde',
}

/**
 * Autorizar es este salto y ningún otro. Se nombra aquí para que la pantalla de
 * autorización lo lea de las constantes en vez de escribirlo a mano: si el
 * vault corrige el semáforo, el texto de la pantalla se corrige solo.
 */
export const AUTHORIZATION_TRANSITION = {
  from: 'APPLE_GREEN',
  to: 'GREEN',
} as const satisfies { from: RequisitionStatus; to: RequisitionStatus }

/**
 * Rechazar solo puede llevar a `PURPLE`: es la única salida de
 * `APPLE_GREEN` que no es autorizar, según las transiciones del semáforo.
 */
export const REJECTION_STATUS: RequisitionStatus = 'PURPLE'
