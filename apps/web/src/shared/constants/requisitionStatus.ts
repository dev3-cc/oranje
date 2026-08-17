import type { StatusLightToken } from '@oranje/ui'

/**
 * Semáforo de Requisición: estados, transiciones válidas y cómo se pintan.
 *
 * A diferencia del de Onboarding, este NO se dedujo de una captura: está
 * transcrito del ejemplo de `NOMENCLATURA.md` §5, que a su vez sale del vault.
 * Las transiciones son las de ahí, literales.
 *
 * ⚠ Mismo domicilio provisional que el de Onboarding: su sitio es
 * `packages/domain/src/statusLights/requisitionStatusLight.ts`, hoy fuera del alcance
 * acordado.
 */
export const REQUISITION_STATUSES = [
  'VERDE_MANZANA',
  'VERDE',
  'AMARILLO',
  'AZUL_CLARO',
  'ROJO',
  'MORADO',
] as const

export type RequisitionStatus = (typeof REQUISITION_STATUSES)[number]

/** Qué significa cada color EN ESTE semáforo. En otro dice otra cosa. */
export const REQUISITION_STATUS_LABEL: Record<RequisitionStatus, string> = {
  VERDE_MANZANA: 'En elaboración',
  VERDE: 'Autorizada',
  AMARILLO: 'En proceso',
  AZUL_CLARO: 'Cubierta totalmente',
  ROJO: 'Cubierta parcialmente',
  MORADO: 'Eliminada',
}

export const REQUISITION_STATUS_TOKEN: Record<RequisitionStatus, StatusLightToken> = {
  VERDE_MANZANA: 'st-verde-manzana',
  VERDE: 'st-verde',
  AMARILLO: 'st-amarillo',
  AZUL_CLARO: 'st-azul-claro',
  ROJO: 'st-rojo',
  MORADO: 'st-morado',
}

/** Transcritas de §5. Cambiarlas exige actualizar antes la nota del vault. */
export const REQUISITION_TRANSITIONS: Record<RequisitionStatus, readonly RequisitionStatus[]> = {
  VERDE_MANZANA: ['VERDE', 'MORADO'],
  VERDE: ['AMARILLO', 'MORADO'],
  AMARILLO: ['AZUL_CLARO', 'ROJO'],
  AZUL_CLARO: [],
  ROJO: ['AMARILLO'],
  MORADO: [],
}

/**
 * Semáforo de Urgencia: cuánto falta para que empiece la requisición.
 *
 * Lo calcula el BACKEND a partir de la fecha de inicio; el front solo lo pinta.
 * Si lo calculara aquí, dos pantallas abiertas a distinta hora mostrarían
 * urgencias distintas para la misma requisición.
 */
export const URGENCY_LEVELS = ['ROJO', 'AMARILLO', 'VERDE'] as const

export type UrgencyLevel = (typeof URGENCY_LEVELS)[number]

export const URGENCY_LABEL: Record<UrgencyLevel, string> = {
  ROJO: '< 72 h',
  AMARILLO: '72 – 120 h',
  VERDE: '> 120 h',
}

export const URGENCY_TOKEN: Record<UrgencyLevel, StatusLightToken> = {
  ROJO: 'st-rojo',
  AMARILLO: 'st-amarillo',
  VERDE: 'st-verde',
}

/**
 * El color por su nombre, para cuando hay que nombrarlo en una frase: «las 2
 * posiciones nacen en Rojo». Ahí el chip no sirve porque va dentro del texto.
 */
export const URGENCY_COLOR_NAME: Record<UrgencyLevel, string> = {
  ROJO: 'Rojo',
  AMARILLO: 'Amarillo',
  VERDE: 'Verde',
}

/**
 * Autorizar es este salto y ningún otro. Se nombra aquí para que la pantalla de
 * autorización lo lea de las constantes en vez de escribirlo a mano: si el
 * vault corrige el semáforo, el texto de la pantalla se corrige solo.
 */
export const AUTHORIZATION_TRANSITION = {
  from: 'VERDE_MANZANA',
  to: 'VERDE',
} as const satisfies { from: RequisitionStatus; to: RequisitionStatus }

/**
 * Rechazar solo puede llevar a `MORADO`: es la única salida de
 * `VERDE_MANZANA` que no es autorizar, según las transiciones de §5.
 */
export const REJECTION_STATUS: RequisitionStatus = 'MORADO'
