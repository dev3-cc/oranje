import { WORKER_ROLE } from '@/shared/constants/roles'

/**
 * Quién entra a la app y a qué apartado. La app tiene UN solo login: al
 * entrar, el rol decide el destino — el Colaborador a su apartado de siempre,
 * la gente del hotel al suyo. El resto del staff (Ventas, Reclutamiento,
 * Inspección…) trabaja en el web y aquí ve una pantalla que se lo dice.
 */

/** Supervisor, Manager de Área y Manager General (D-18): los roles del hotel. */
export const HOTEL_ROLES: ReadonlySet<string> = new Set(['ROL-H-01', 'ROL-H-02', 'ROL-H-03'])

export const WORKER_HOME = '/collaborator'
export const HOTEL_HOME = '/hotel'
export const UNSUPPORTED_HOME = '/unsupported'

export function isHotelRole(roleId: string | undefined): boolean {
  return roleId !== undefined && HOTEL_ROLES.has(roleId)
}

export function isWorkerRole(roleId: string | undefined): boolean {
  return roleId === WORKER_ROLE
}

/** El apartado de cada rol dentro de la app. */
export function homePathFor(roleId: string | undefined): string {
  if (isWorkerRole(roleId)) return WORKER_HOME
  if (isHotelRole(roleId)) return HOTEL_HOME
  return UNSUPPORTED_HOME
}
