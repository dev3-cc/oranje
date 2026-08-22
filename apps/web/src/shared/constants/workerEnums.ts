/**
 * Los enum del CHECK real de `personal.worker` (create-worker.dto.ts del
 * backend), con su texto en español. Compartidos: los usa el apartado del
 * Colaborador (fases 2-3) y el Expediente de la Reclutadora.
 */

export const EXPERIENCE_LEVELS = ['NONE', 'ONE_TO_TWO', 'THREE_TO_FIVE', 'MORE_THAN_FIVE'] as const
export const EXPERIENCE_LABEL: Record<string, string> = {
  NONE: 'Sin experiencia',
  ONE_TO_TWO: '1–2 años',
  THREE_TO_FIVE: '3–5 años',
  MORE_THAN_FIVE: 'Más de 5 años',
}

export const TRANSPORT_TYPES = ['OWN', 'PUBLIC', 'OTHER'] as const
export const TRANSPORT_LABEL: Record<string, string> = {
  OWN: 'Propio',
  PUBLIC: 'Público',
  OTHER: 'Otro',
}

export const RELATIONSHIPS = [
  'MOTHER',
  'FATHER',
  'SPOUSE',
  'SIBLING',
  'CHILD',
  'FRIEND',
  'OTHER',
] as const
export const RELATIONSHIP_LABEL: Record<string, string> = {
  MOTHER: 'Madre',
  FATHER: 'Padre',
  SPOUSE: 'Cónyuge',
  SIBLING: 'Hermano/a',
  CHILD: 'Hijo/a',
  FRIEND: 'Amistad',
  OTHER: 'Otro',
}

export const BLOOD_TYPES = [
  'A_POS',
  'A_NEG',
  'B_POS',
  'B_NEG',
  'AB_POS',
  'AB_NEG',
  'O_POS',
  'O_NEG',
  'UNKNOWN',
] as const
export const BLOOD_LABEL: Record<string, string> = {
  A_POS: 'A+',
  A_NEG: 'A−',
  B_POS: 'B+',
  B_NEG: 'B−',
  AB_POS: 'AB+',
  AB_NEG: 'AB−',
  O_POS: 'O+',
  O_NEG: 'O−',
  UNKNOWN: 'No sé',
}

export const GENDER_LABEL: Record<string, string> = {
  FEMALE: 'Femenino',
  MALE: 'Masculino',
}
