import type { StatusLightToken } from '@oranje/ui'

/**
 * Semáforo de Onboarding: estados, transiciones válidas y cómo se pintan.
 *
 * ⚠ ESTE ARCHIVO ESTÁ EN EL LUGAR EQUIVOCADO A PROPÓSITO.
 *
 * Según Estructura de Proyecto §6 los semáforos viven en `packages/domain/src/statusLights/`, que es la
 * fuente de verdad en código, y `packages/domain` hoy está vacío y fuera del
 * alcance de este trabajo (solo se toca `apps/web`). Queda aquí para no
 * bloquear las pantallas, y debe migrarse tal cual a
 * `packages/domain/src/statusLights/onboardingStatusLight.ts` en cuanto se pueda
 * tocar ese paquete.
 *
 * Vive en `shared/constants/` y no dentro de una feature porque lo consumen
 * `onboarding` y `territory`, y §4 prohíbe que una feature importe de otra.
 *
 * Códigos y transiciones copiados del seed de la API (`apps/api/prisma/seed.ts`,
 * semáforo ONBOARDING): son los que `catalogs.status_light_state` acepta y los
 * que viajan por HTTP. Un cambio allá obliga a cambiar aquí.
 */
export const OnboardingStatus = {
  GRAY: 'GRAY',
  LIGHT_BLUE: 'LIGHT_BLUE',
  GREEN: 'GREEN',
  YELLOW: 'YELLOW',
  PINK: 'PINK',
  BROWN: 'BROWN',
  ORANGE: 'ORANGE',
  RED: 'RED',
  BLACK: 'BLACK',
} as const

export type OnboardingStatus = (typeof OnboardingStatus)[keyof typeof OnboardingStatus]

/**
 * Los nombres de color se quedan en español porque son los del token
 * (`--st-azul-claro`) y §5 dice que los tokens no se renombran. Lo que va en
 * inglés es todo lo demás del dominio (`Prospect`, `status`, `owner`).
 */
export const ONBOARDING_STATUS_TOKEN: Record<OnboardingStatus, StatusLightToken> = {
  GRAY: 'st-gris',
  LIGHT_BLUE: 'st-azul-claro',
  GREEN: 'st-verde',
  YELLOW: 'st-amarillo',
  PINK: 'st-rosa',
  BROWN: 'st-cafe',
  ORANGE: 'st-naranja',
  RED: 'st-rojo',
  BLACK: 'st-negro',
} as const

/** Texto del chip. Es el nombre del color, tal como aparece en el diseño. */
export const ONBOARDING_STATUS_LABEL: Record<OnboardingStatus, string> = {
  GRAY: 'Gris',
  LIGHT_BLUE: 'Azul claro',
  GREEN: 'Verde',
  YELLOW: 'Amarillo',
  PINK: 'Rosa',
  BROWN: 'Cafe',
  ORANGE: 'Naranja',
  RED: 'Rojo',
  BLACK: 'Negro',
}

/** Qué significa el color en ESTE semáforo. El mismo color dice otra cosa en los otros. */
export const ONBOARDING_STATUS_DESCRIPTION: Record<OnboardingStatus, string> = {
  GRAY: 'Hotel identificado',
  LIGHT_BLUE: 'Contacto y datos',
  GREEN: 'Propuesta enviada',
  YELLOW: 'Seguimiento',
  PINK: 'Negociación de términos',
  BROWN: 'Renegociación / desbloqueo',
  ORANGE: 'Cliente activo',
  RED: 'Rechazo o no interés',
  BLACK: 'Cliente pausado o inactivo',
}

/**
 * Las 12 aristas del seed (13 filas: `GREEN → BROWN` la autorizan BD o BDC).
 * Solo son referencia para los mocks: en pantalla las transiciones vienen de
 * `GET /prospects/:id/transitions`, ya filtradas por rol.
 */
export const ONBOARDING_TRANSITIONS: Record<OnboardingStatus, readonly OnboardingStatus[]> = {
  GRAY: ['LIGHT_BLUE'],
  LIGHT_BLUE: ['GREEN'],
  GREEN: ['YELLOW', 'RED', 'BROWN'],
  YELLOW: ['PINK'],
  PINK: ['ORANGE', 'BROWN'],
  ORANGE: ['BLACK'],
  /** RR-V-07: Azul claro es el ÚNICO punto de reentrada. */
  RED: ['LIGHT_BLUE'],
  BROWN: ['LIGHT_BLUE'],
  BLACK: ['LIGHT_BLUE'],
}

/**
 * Columnas del tablero, en orden. `ORANGE`, `RED` y `BLACK` quedan fuera: el
 * tablero es de prospectos ABIERTOS. Los convertidos se ven en Clientes
 * Activos y los rechazados no se arrastran por el pipeline.
 */
export const PIPELINE_COLUMNS: readonly OnboardingStatus[] = [
  'GRAY',
  'LIGHT_BLUE',
  'GREEN',
  'YELLOW',
  'PINK',
  'BROWN',
]

/**
 * Ya no queda como "sin transiciones": desde el seed TODOS los estados tienen
 * salida (RED, BROWN y BLACK reentran por Azul claro). Terminal aquí significa
 * que el prospecto salió del pipeline activo.
 */
const TERMINAL_STATUSES: readonly OnboardingStatus[] = ['ORANGE', 'RED', 'BLACK']

export function isTerminalStatus(status: OnboardingStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}
