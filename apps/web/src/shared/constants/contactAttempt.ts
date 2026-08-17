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
 * ⚠ Los valores definitivos los fija la migración de `apps/api`. Estos salen de
 * leer el modal, así que hay que cuadrarlos cuando exista el CHECK real.
 *
 * Van en español, como los colores del semáforo: son términos del vault, no
 * identificadores traducibles.
 */

export const CONTACT_ATTEMPT_TYPES = ['VISITA_EN_FRIO', 'LLAMADA', 'CORREO'] as const

export type ContactAttemptType = (typeof CONTACT_ATTEMPT_TYPES)[number]

export const CONTACT_ATTEMPT_TYPE_LABEL: Record<ContactAttemptType, string> = {
  VISITA_EN_FRIO: 'Visita en frío',
  LLAMADA: 'Llamada',
  CORREO: 'Correo',
}

export const CONTACT_ATTEMPT_OUTCOMES = [
  'NO_CONTESTO',
  'INTERESADO',
  'NO_INTERESADO',
  'CITA_AGENDADA',
] as const

export type ContactAttemptOutcome = (typeof CONTACT_ATTEMPT_OUTCOMES)[number]

export const CONTACT_ATTEMPT_OUTCOME_LABEL: Record<ContactAttemptOutcome, string> = {
  NO_CONTESTO: 'No contestó',
  INTERESADO: 'Interesado',
  NO_INTERESADO: 'No interesado',
  CITA_AGENDADA: 'Cita agendada',
}
