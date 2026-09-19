import { msg } from '@lingui/core/macro'

import { labelMap } from '@/shared/lib/i18nLabels'

/**
 * Los enum del CHECK real de `personal.worker` (create-worker.dto.ts del
 * backend), con su texto en español. Compartidos: los usa el apartado del
 * Colaborador (fases 2-3) y el Expediente de la Reclutadora.
 */

export const EXPERIENCE_LEVELS = ['NONE', 'ONE_TO_TWO', 'THREE_TO_FIVE', 'MORE_THAN_FIVE'] as const
const EXPERIENCE_MESSAGE = {
  NONE: msg`Sin experiencia`,
  ONE_TO_TWO: msg`1–2 años`,
  THREE_TO_FIVE: msg`3–5 años`,
  MORE_THAN_FIVE: msg`Más de 5 años`,
}
export const EXPERIENCE_LABEL: Record<string, string> = labelMap(EXPERIENCE_MESSAGE)

export const TRANSPORT_TYPES = ['OWN', 'PUBLIC', 'OTHER'] as const
const TRANSPORT_MESSAGE = {
  OWN: msg`Propio`,
  PUBLIC: msg`Público`,
  OTHER: msg`Otro`,
}
export const TRANSPORT_LABEL: Record<string, string> = labelMap(TRANSPORT_MESSAGE)

export const RELATIONSHIPS = [
  'MOTHER',
  'FATHER',
  'SPOUSE',
  'SIBLING',
  'CHILD',
  'FRIEND',
  'OTHER',
] as const
const RELATIONSHIP_MESSAGE = {
  MOTHER: msg`Madre`,
  FATHER: msg`Padre`,
  SPOUSE: msg`Cónyuge`,
  SIBLING: msg`Hermano/a`,
  CHILD: msg`Hijo/a`,
  FRIEND: msg`Amistad`,
  OTHER: msg`Otro`,
}
export const RELATIONSHIP_LABEL: Record<string, string> = labelMap(RELATIONSHIP_MESSAGE)

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
const BLOOD_MESSAGE = {
  A_POS: msg`A+`,
  A_NEG: msg`A−`,
  B_POS: msg`B+`,
  B_NEG: msg`B−`,
  AB_POS: msg`AB+`,
  AB_NEG: msg`AB−`,
  O_POS: msg`O+`,
  O_NEG: msg`O−`,
  UNKNOWN: msg`No sé`,
}
export const BLOOD_LABEL: Record<string, string> = labelMap(BLOOD_MESSAGE)

const GENDER_MESSAGE = {
  FEMALE: msg`Femenino`,
  MALE: msg`Masculino`,
}
export const GENDER_LABEL: Record<string, string> = labelMap(GENDER_MESSAGE)
