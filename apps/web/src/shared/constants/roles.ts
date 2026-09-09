import { i18n } from '@lingui/core'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

/**
 * Cómo se PINTA cada rol. La autoridad del rol es `identity.role` (catálogo
 * D-18, sembrado en la API); aquí solo viven las etiquetas visibles, que el
 * contrato no trae porque el front las decide.
 *
 * Solo los roles que hoy tienen pantalla. Un código sin fila se pinta tal
 * cual: mejor un `ROL-X-NN` visible que inventar un título.
 */
export interface RoleLabel {
  /** Siglas junto al nombre: `BD`. */
  short: string
  /** Nombre largo del rol: `Business Developer`. */
  title: string
}

/** El único rol que NO usa el shell del staff: su apartado es `/colaborador`. */
export const WORKER_ROLE = 'ROL-C-01'

/**
 * El título habla el idioma activo (D-36); las siglas no se traducen.
 *
 * Solo tenía 4 de los 19 roles del catálogo del vault (D-18, «Roles del
 * Sistema») — cualquier otro rol caía al `roleCode` crudo en el fallback
 * (`ROL-H-01` en vez de «Supervisor»), visible en la tarjeta de perfil del
 * sidebar. Completados los 15 que faltaban.
 */
const ROLE_MESSAGE: Partial<Record<string, { short: string; title: MessageDescriptor }>> = {
  'ROL-H-01': { short: 'SUP', title: msg`Supervisor` },
  'ROL-H-02': { short: 'MA', title: msg`Manager de Área` },
  'ROL-H-03': { short: 'MG', title: msg`Manager General` },
  'ROL-R-01': { short: 'RECL', title: msg`Reclutadora` },
  'ROL-R-02': { short: 'LIDER', title: msg`Líder de Grupo de Reclutadoras` },
  'ROL-R-03': { short: 'MREC', title: msg`Manager de Reclutamiento` },
  'ROL-V-01': { short: 'BD', title: msg`Business Developer` },
  'ROL-V-02': { short: 'BDC', title: msg`Business Developer Coordinator` },
  'ROL-I-01': { short: 'INSP', title: msg`Inspector` },
  'ROL-I-02': { short: 'COORD', title: msg`Coordinador de Inspección` },
  'ROL-Q-01': { short: 'OQA', title: msg`Operador de QA` },
  'ROL-Q-02': { short: 'MQA', title: msg`Manager de QA` },
  'ROL-CS-01': { short: 'AGCS', title: msg`Agente de Customer Service` },
  'ROL-CS-02': { short: 'CSM', title: msg`Customer Service Manager` },
  'ROL-CO-01': { short: 'CONT', title: msg`Contadora` },
  'ROL-CO-02': { short: 'MCO', title: msg`Manager de Contabilidad` },
  'ROL-C-01': { short: 'COLAB', title: msg`Colaborador` },
  'ROL-SYS-01': { short: 'SYS', title: msg`Sistema` },
  'ROL-ADM-01': { short: 'ADMIN', title: msg`Administrador` },
}

/** Se resuelve AL LLAMAR, no al cargar: así sigue al idioma en caliente. */
export function roleLabelOf(roleCode: string): RoleLabel {
  const entry = ROLE_MESSAGE[roleCode]
  return entry
    ? { short: entry.short, title: i18n._(entry.title) }
    : { short: roleCode, title: roleCode }
}
