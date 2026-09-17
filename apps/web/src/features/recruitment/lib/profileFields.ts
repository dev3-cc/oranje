import type { I18n } from '@lingui/core'
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
