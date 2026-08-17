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
 * ⚠ Y LAS TRANSICIONES ESTÁN DERIVADAS DEL DISEÑO, NO DEL VAULT.
 *
 * Se reconstruyeron leyendo el timeline y el modal de las capturas. §5 es
 * explícito: «los valores de esta carpeta se derivan del vault, no se
 * inventan». Antes de dar esto por bueno tiene que validarlo la nota del
 * semáforo de Onboarding y pasar por `semaforo-guardian`.
 */
export const OnboardingStatus = {
  GRIS: 'GRIS',
  AZUL_CLARO: 'AZUL_CLARO',
  VERDE: 'VERDE',
  AMARILLO: 'AMARILLO',
  ROSA: 'ROSA',
  CAFE: 'CAFE',
  NARANJA: 'NARANJA',
  ROJO: 'ROJO',
} as const

export type OnboardingStatus = (typeof OnboardingStatus)[keyof typeof OnboardingStatus]

/**
 * Los nombres de color se quedan en español porque son los del token
 * (`--st-azul-claro`) y §5 dice que los tokens no se renombran. Lo que va en
 * inglés es todo lo demás del dominio (`Prospect`, `status`, `owner`).
 */
export const ONBOARDING_STATUS_TOKEN: Record<OnboardingStatus, StatusLightToken> = {
  GRIS: 'st-gris',
  AZUL_CLARO: 'st-azul-claro',
  VERDE: 'st-verde',
  AMARILLO: 'st-amarillo',
  ROSA: 'st-rosa',
  CAFE: 'st-cafe',
  NARANJA: 'st-naranja',
  ROJO: 'st-rojo',
}

/** Texto del chip. Es el nombre del color, tal como aparece en el diseño. */
export const ONBOARDING_STATUS_LABEL: Record<OnboardingStatus, string> = {
  GRIS: 'Gris',
  AZUL_CLARO: 'Azul claro',
  VERDE: 'Verde',
  AMARILLO: 'Amarillo',
  ROSA: 'Rosa',
  CAFE: 'Cafe',
  NARANJA: 'Naranja',
  ROJO: 'Rojo',
}

/** Qué significa el color en ESTE semáforo. El mismo color dice otra cosa en los otros. */
export const ONBOARDING_STATUS_DESCRIPTION: Record<OnboardingStatus, string> = {
  GRIS: 'Hotel identificado',
  AZUL_CLARO: 'Contacto y datos',
  VERDE: 'Propuesta enviada',
  AMARILLO: 'Seguimiento',
  /**
   * Corregido con la captura de Mi Territorio, que lo nombra directamente. La
   * columna Rosa del tablero quedaba fuera de encuadre en la captura del
   * Pipeline, así que antes decía «T&C creado y validado», que era la NOTA de
   * la transición Amarillo → Rosa, no el nombre del estado.
   */
  ROSA: 'Negociación de términos',
  CAFE: 'Renegociación / desbloqueo',
  NARANJA: 'Cliente activo',
  ROJO: 'Rechazo o no interés',
}

export const ONBOARDING_TRANSITIONS: Record<OnboardingStatus, readonly OnboardingStatus[]> = {
  GRIS: ['AZUL_CLARO', 'ROJO'],
  AZUL_CLARO: ['VERDE', 'CAFE', 'ROJO'],
  VERDE: ['AMARILLO', 'CAFE', 'ROJO'],
  AMARILLO: ['ROSA', 'CAFE', 'ROJO'],
  ROSA: ['NARANJA', 'CAFE', 'ROJO'],
  CAFE: ['AMARILLO', 'ROSA', 'ROJO'],
  NARANJA: [],
  ROJO: [],
}

/**
 * Columnas del tablero, en orden. `NARANJA` y `ROJO` quedan fuera: son
 * terminales y el tablero es de prospectos ABIERTOS. Los convertidos se ven en
 * Clientes Activos y los rechazados no se arrastran por el pipeline.
 */
export const PIPELINE_COLUMNS: readonly OnboardingStatus[] = [
  'GRIS',
  'AZUL_CLARO',
  'VERDE',
  'AMARILLO',
  'ROSA',
  'CAFE',
]

export function isTerminalStatus(status: OnboardingStatus): boolean {
  return ONBOARDING_TRANSITIONS[status].length === 0
}
