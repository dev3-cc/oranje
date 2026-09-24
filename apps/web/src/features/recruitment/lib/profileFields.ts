import type { I18n, MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import type { WorkerApi } from '@/shared/types/apiContract.types'

/**
 * Los campos que integran `is_profile_complete`, con su clave estable: la
 * clave decide qué se puede arreglar desde «Editar» (Fase 1) y la etiqueta es
 * lo único que se traduce al pintar (D-36).
 */
export const PROFILE_FIELDS = [
  { key: 'position', label: msg`Posición`, isPhase1: true },
  { key: 'english', label: msg`Inglés`, isPhase1: true },
  { key: 'modality', label: msg`Modalidad`, isPhase1: true },
  { key: 'experience', label: msg`Experiencia`, isPhase1: true },
  { key: 'transport', label: msg`Transporte`, isPhase1: false },
  { key: 'emergencyContact', label: msg`Contacto de emergencia`, isPhase1: false },
  { key: 'bloodType', label: msg`Tipo de sangre`, isPhase1: false },
] as const

/**
 * Espejo exacto de `personal.vw_worker.is_profile_complete` (§4 de Estándares
 * de Desarrollo): lo que ahí es un booleano ciego, aquí es la lista de qué
 * falta — «el expediente está a medias» sin decir de qué no sirve de nada.
 *
 * Solo la Fase 1 (Posición, Inglés, Modalidad, Experiencia) la edita
 * Reclutamiento con «Editar»; Transporte y Fase 3 los completa el colaborador
 * desde su app — por eso salen separadas: con Fase 1 pendiente no se valida
 * ni a sabiendas, con solo Fase 2/3 pendiente sí (con plazo de 3 días).
 */
/**
 * Estados en los que el colaborador YA se puede meter a una requisición: el
 * vault lo dice en [[Semáforo del Colaborador]] — Blanco → Verde fuerte es
 * «habilitado en el Pool, disponible para asignación». De Verde fuerte en
 * adelante ya está trabajando o esperando trabajo, no pendiente de nada.
 */
const READY_STATES = ['STRONG_GREEN', 'YELLOW', 'APPLE_GREEN', 'LIGHT_BLUE', 'ORANGE', 'BROWN']

/** Fuera de juego por otra razón: ahí «listo o no» no es la pregunta. */
const OUT_STATES = ['PINK', 'PURPLE', 'RED', 'GRAY', 'BLACK']

export type Readiness =
  | { kind: 'ready' }
  /** `missing` son las etiquetas de lo que falta, para decirlo por su nombre. */
  | { kind: 'pending'; done: number; total: number; missing: MessageDescriptor[] }
  | { kind: 'out' }

/**
 * ¿Este colaborador ya se puede usar en una requisición?
 *
 * No es lo mismo que tener el expediente completo: el vault permite validar
 * **a sabiendas** con datos a medias, y entonces el colaborador queda
 * habilitado aunque le falte algo (Reglas de Negocio · Validación con
 * expediente incompleto). Lo que le falte de la Fase 1 «nunca bloquea nada».
 *
 * Por eso el anillo mide ESTO y no los siete campos:
 *
 * - `ready` — ya está habilitado (Disponible, asignado o trabajando).
 * - `pending` — sigue en Blanco: lo que falta es lo de la **Fase 1**, que es
 *   lo que Reclutamiento necesita para validarlo y saber a qué posición cabe.
 * - `out` — Stand-by, Reportado, Accidentado, vetado: hablar de «listo» ahí
 *   confunde, así que el anillo no opina.
 */
export function assignmentReadiness(worker: WorkerApi): Readiness {
  const state = worker.state.code

  if (OUT_STATES.includes(state)) return { kind: 'out' }
  if (READY_STATES.includes(state)) return { kind: 'ready' }

  const phase1 = PROFILE_FIELDS.filter((field) => field.isPhase1)
  const filled: Record<string, boolean> = {
    position: worker.position !== null,
    english: worker.englishLevel !== null,
    modality: worker.hiringModality !== null,
    experience: worker.experienceLevel !== null,
  }
  const missing = phase1.filter((field) => !filled[field.key])

  return {
    kind: 'pending',
    done: phase1.length - missing.length,
    total: phase1.length,
    missing: missing.map((field) => field.label),
  }
}

export function missingProfile(
  worker: WorkerApi,
  i18n: I18n,
): { labels: string[]; phase1: string[]; later: string[] } {
  const missingKeys: Record<string, boolean> = {
    position: worker.position === null,
    english: worker.englishLevel === null,
    modality: worker.hiringModality === null,
    experience: worker.experienceLevel === null,
    transport: worker.transportType === null,
    emergencyContact: worker.emergencyContact === null,
    bloodType: worker.bloodType === null,
  }
  const missing = worker.isProfileComplete
    ? []
    : PROFILE_FIELDS.filter((field) => missingKeys[field.key])

  return {
    labels: missing.map((field) => i18n._(field.label)),
    phase1: missing.filter((field) => field.isPhase1).map((field) => i18n._(field.label)),
    later: missing.filter((field) => !field.isPhase1).map((field) => i18n._(field.label)),
  }
}
