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

export const ROLE_LABEL: Partial<Record<string, RoleLabel>> = {
  'ROL-C-01': { short: 'COLAB', title: 'Colaborador' },
  'ROL-V-01': { short: 'BD', title: 'Business Developer' },
  'ROL-V-02': { short: 'BDC', title: 'Business Developer Coordinator' },
  'ROL-ADM-01': { short: 'ADMIN', title: 'Administrador' },
}

export function roleLabelOf(roleCode: string): RoleLabel {
  return ROLE_LABEL[roleCode] ?? { short: roleCode, title: roleCode }
}
