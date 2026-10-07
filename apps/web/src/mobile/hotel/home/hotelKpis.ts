import type { AppRequisitionRow } from '../requisitions/requisitionsAppApi'

/**
 * Los KPIs del Inicio del hotel, calculados con lo que ya devuelve
 * `GET /requisitions` (con el alcance de la sesión: el Manager General, todo
 * el hotel; el de Área, su departamento). Sin endpoints nuevos: lo que pide
 * datos que el API aún no agrega —time to fill, puntualidad, inasistencias,
 * costo— queda fuera hasta que el backend lo exponga.
 */

/** Autorizadas o en trabajo de Reclutamiento: lo que todavía se está cubriendo. */
const OPEN: ReadonlySet<string> = new Set(['GREEN', 'YELLOW', 'RED'])

/** Ventana del promedio de autorización: lo reciente, no la historia entera. */
const AUTHORIZATION_WINDOW_DAYS = 90

export interface HotelKpis {
  /** Autorizadas, en proceso o cubiertas a medias. */
  open: number
  /** En elaboración: esperan la firma de un Manager. */
  awaitingAuthorization: number
  /**
   * Borradores y abiertas cuya posición más apurada empieza en menos de 3 días
   * (RR-H-05) y todavía no se cubre. El borrador cuenta: es el que más urge
   * firmar.
   */
  urgent: number
  /** Lugares todavía sin cubrir en las abiertas. */
  openSlots: number
  /** Cobertura de las abiertas: cubiertos ÷ pedidos. `null` sin abiertas. */
  fillRate: number | null
  /** Horas promedio de creada a autorizada, últimos 90 días. `null` sin datos. */
  avgHoursToAuthorize: number | null
  /** Lugares sin cubrir por departamento, de mayor a menor. */
  demandByDepartment: Array<{ department: string; open: number }>
}

export function computeHotelKpis(rows: AppRequisitionRow[], now: number = Date.now()): HotelKpis {
  const open = rows.filter((row) => OPEN.has(row.status))
  const requested = open.reduce((total, row) => total + row.total, 0)
  const filled = open.reduce((total, row) => total + row.filled, 0)

  const since = now - AUTHORIZATION_WINDOW_DAYS * 86_400_000
  const authorizationHours = rows
    .filter((row) => row.authorizedAt !== null && new Date(row.authorizedAt).getTime() >= since)
    .map(
      (row) =>
        (new Date(row.authorizedAt as string).getTime() - new Date(row.createdAt).getTime()) /
        3_600_000,
    )
    .filter((hours) => hours >= 0)

  const demand = new Map<string, number>()
  for (const row of open) {
    for (const item of row.openByDepartment) {
      if (item.open > 0) demand.set(item.department, (demand.get(item.department) ?? 0) + item.open)
    }
  }

  return {
    open: open.length,
    awaitingAuthorization: rows.filter((row) => row.status === 'APPLE_GREEN').length,
    urgent: rows.filter(
      (row) =>
        (OPEN.has(row.status) || row.status === 'APPLE_GREEN') &&
        row.urgency === 'RED' &&
        row.filled < row.total,
    ).length,
    openSlots: requested - filled,
    fillRate: requested === 0 ? null : filled / requested,
    avgHoursToAuthorize:
      authorizationHours.length === 0
        ? null
        : authorizationHours.reduce((total, hours) => total + hours, 0) / authorizationHours.length,
    demandByDepartment: [...demand.entries()]
      .map(([department, slots]) => ({ department, open: slots }))
      .sort((a, b) => b.open - a.open),
  }
}
