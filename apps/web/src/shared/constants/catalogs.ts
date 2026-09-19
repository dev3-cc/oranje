import { msg } from '@lingui/core/macro'

import { labelMap } from '@/shared/lib/i18nLabels'

/**
 * Catálogos compartidos del dominio.
 *
 * Viven en `shared/` porque los usan varias features y §4 prohíbe que una
 * importe de otra: el nivel de inglés lo pide una requisición y lo tiene un
 * colaborador, y son la MISMA lista — si cada pantalla llevara la suya, un día
 * una tendría «Conversacional» y la otra no, y el emparejamiento fallaría sin
 * que nadie supiera por qué.
 *
 * ⚠ Su sitio es `packages/domain/src/catalogos/`, hoy fuera del alcance.
 */

/**
 * Niveles de inglés. `NO_REQUERIDO` solo tiene sentido pidiendo —una posición
 * que no lo exige—, nunca describiendo a una persona.
 */
export const ENGLISH_LEVELS = [
  'NO_REQUERIDO',
  'BASICO',
  'CONVERSACIONAL',
  'INTERMEDIO',
  'AVANZADO',
] as const

export type EnglishLevel = (typeof ENGLISH_LEVELS)[number]

const ENGLISH_LEVEL_MESSAGE = {
  NO_REQUERIDO: msg`No requerido`,
  BASICO: msg`Básico`,
  CONVERSACIONAL: msg`Conversacional`,
  INTERMEDIO: msg`Intermedio`,
  AVANZADO: msg`Avanzado`,
}

export const ENGLISH_LEVEL_LABEL: Record<EnglishLevel, string> = labelMap(ENGLISH_LEVEL_MESSAGE)

/** Los que puede tener una persona: lo demás es lo que pide una posición. */
export const WORKER_ENGLISH_LEVELS: readonly EnglishLevel[] = [
  'BASICO',
  'CONVERSACIONAL',
  'INTERMEDIO',
  'AVANZADO',
]

/**
 * Cómo se contrata a una persona. NO es la modalidad de una posición de
 * requisición —«Por evento» o «Nómina»—: aquella dice cómo se paga ese puesto y
 * esta, qué disponibilidad tiene el colaborador.
 */
export const HIRING_MODALITIES = [
  'TIEMPO_COMPLETO',
  'MEDIO_TIEMPO',
  'TEMPORAL',
  'SEGUN_SOLICITUD',
] as const

export type HiringModality = (typeof HIRING_MODALITIES)[number]

const HIRING_MODALITY_MESSAGE = {
  TIEMPO_COMPLETO: msg`Tiempo completo`,
  MEDIO_TIEMPO: msg`Medio tiempo`,
  TEMPORAL: msg`Temporal`,
  SEGUN_SOLICITUD: msg`Según solicitud`,
}

export const HIRING_MODALITY_LABEL: Record<HiringModality, string> =
  labelMap(HIRING_MODALITY_MESSAGE)

/** Posiciones del catálogo, las mismas que cotiza un contrato. */
export const CATALOG_POSITIONS = ['Housekeeper', 'Houseman', 'Laundry', 'Chef'] as const

export type CatalogPosition = (typeof CATALOG_POSITIONS)[number]
