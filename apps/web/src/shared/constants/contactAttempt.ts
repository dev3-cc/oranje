/**
 * Listas cerradas del intento de contacto.
 *
 * ⚠ SON CHECK EN LA BASE, NO CATÁLOGO. El diseño lo dice explícitamente:
 * «attempt_type — lista cerrada con CHECK, no catálogo». Por eso viven en
 * código y NO se piden a `/catalogs`: un catálogo se edita en runtime, un CHECK
 * exige migración. Compárese con los motivos del cambio de estado, que sí
 * salen de `catalogs.status_change_reason`.
 *
 * ⚠ Mismo domicilio provisional que el semáforo: su lugar es
 * `packages/domain`, que hoy está fuera del alcance acordado.
 *
 * Los valores son los del CHECK real (`CreateContactAttemptDto` de `apps/api`):
 * identificadores en inglés por D-11, etiquetas en español para la UI.
 */

export const CONTACT_ATTEMPT_TYPES = ['COLD_VISIT', 'CALL', 'EMAIL'] as const

export type ContactAttemptType = (typeof CONTACT_ATTEMPT_TYPES)[number]

export const CONTACT_ATTEMPT_TYPE_LABEL: Record<ContactAttemptType, string> = {
  COLD_VISIT: 'Visita en frío',
  CALL: 'Llamada',
  EMAIL: 'Correo',
}

export const CONTACT_ATTEMPT_OUTCOMES = [
  'NO_ANSWER',
  'INTERESTED',
  'NOT_INTERESTED',
  'MEETING_SET',
] as const

export type ContactAttemptOutcome = (typeof CONTACT_ATTEMPT_OUTCOMES)[number]

export const CONTACT_ATTEMPT_OUTCOME_LABEL: Record<ContactAttemptOutcome, string> = {
  NO_ANSWER: 'No contestó',
  INTERESTED: 'Interesado',
  NOT_INTERESTED: 'No interesado',
  MEETING_SET: 'Cita agendada',
}
