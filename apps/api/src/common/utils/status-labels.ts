/**
 * Cómo se llama cada estado cuando se lo decimos a una PERSONA. Los códigos
 * (`YELLOW`, `PENDING_APPROVAL`, `ACTIVE`) son identificadores (D-11): viven
 * en la base y en el contrato, nunca en un mensaje que alguien lea. Los
 * semáforos toman el nombre del seed; los estados de texto + CHECK, el que
 * usa el front para el mismo valor.
 */
const REQUISITION_STATE: Record<string, string> = {
  APPLE_GREEN: 'En elaboración',
  GREEN: 'Autorizada',
  YELLOW: 'En proceso',
  LIGHT_BLUE: 'Cubierta totalmente',
  RED: 'Cubierta parcialmente',
  PURPLE: 'Eliminada',
}

const WORKER_STATE: Record<string, string> = {
  WHITE: 'Pre-asignación',
  APPLE_GREEN: 'Día 1-2',
  LIGHT_BLUE: 'Día 3+',
  ORANGE: 'Fijo',
  STRONG_GREEN: 'Disponible',
  YELLOW: 'Disponible voluntario',
  BROWN: 'Asignación temporal',
  PINK: 'Stand-by',
  PURPLE: 'No regresó',
  RED: 'Reportado',
  GRAY: 'Accidentado',
  BLACK: 'Blacklist',
}

const TIMESHEET_STATUS: Record<string, string> = {
  OPEN: 'abierta',
  PENDING_APPROVAL: 'enviada a aprobación',
  APPROVED: 'aprobada',
}

const ASSIGNMENT_STATUS: Record<string, string> = {
  ACTIVE: 'activa',
  CLOSED: 'cerrada',
  CANCELLED: 'cancelada',
}

const CONTRACT_STATUS: Record<string, string> = {
  DRAFT: 'borrador',
  ACTIVE: 'vigente',
  EXPIRED: 'expirado',
  CANCELLED: 'cancelado',
}

const CONSOLIDATION_STATUS: Record<string, string> = {
  DRAFT: 'borrador',
  VALIDATED: 'validado',
  AUTHORIZED: 'autorizado',
  PAID: 'pagado',
}

const INVOICE_STATUS: Record<string, string> = {
  DRAFT: 'borrador',
  APPROVED: 'aprobada',
  SENT: 'enviada',
  PAID: 'pagada',
}

function labelOf(map: Record<string, string>, code: string): string {
  return map[code] ?? code.toLowerCase().replace(/_/g, ' ')
}

export const requisitionStateLabel = (code: string): string => labelOf(REQUISITION_STATE, code)
export const workerStateLabel = (code: string): string => labelOf(WORKER_STATE, code)
export const timesheetStatusLabel = (code: string): string => labelOf(TIMESHEET_STATUS, code)
export const assignmentStatusLabel = (code: string): string => labelOf(ASSIGNMENT_STATUS, code)
export const contractStatusLabel = (code: string): string => labelOf(CONTRACT_STATUS, code)
export const consolidationStatusLabel = (code: string): string =>
  labelOf(CONSOLIDATION_STATUS, code)
export const invoiceStatusLabel = (code: string): string => labelOf(INVOICE_STATUS, code)
