import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import type { TimesheetApi, WorkerApi } from '@/shared/types/apiContract.types'

/**
 * Ingresos y retención de colaboradores, a partir de las semanas de timesheet.
 *
 * Una fila de timesheet (colaborador × requisición × semana) solo se crea
 * cuando la persona poncha (`ensureDayTx` en el repositorio del API), así que
 * «tiene timesheet esa semana» = «trabajó esa semana». La granularidad es la
 * semana: no dice cuántos días.
 *
 * Las semanas se agrupan por su lunes (la semana del contrato puede empezar
 * otro día).
 */

const MS_PER_DAY = 86_400_000

function utcOf(day: string): number {
  return Date.parse(`${day.slice(0, 10)}T00:00:00Z`)
}

function isoOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** El lunes de la semana de un `AAAA-MM-DD`. */
export function mondayOf(day: string): string {
  const ms = utcOf(day)
  const sinceMonday = (new Date(ms).getUTCDay() + 6) % 7
  return isoOf(ms - sinceMonday * MS_PER_DAY)
}

export function addWeeks(monday: string, weeks: number): string {
  return isoOf(utcOf(monday) + weeks * 7 * MS_PER_DAY)
}

export function weeksBetween(fromMonday: string, toMonday: string): number {
  return Math.round((utcOf(toMonday) - utcOf(fromMonday)) / (7 * MS_PER_DAY))
}

function monthOf(day: string): string {
  return day.slice(0, 7)
}

function addMonths(month: string, months: number): string {
  const [year, mon] = month.split('-').map(Number) as [number, number]
  const date = new Date(Date.UTC(year, mon - 1 + months, 1))
  return date.toISOString().slice(0, 7)
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number) as [number, number]
  const [ty, tm] = to.split('-').map(Number) as [number, number]
  return (ty - fy) * 12 + (tm - fm)
}

// --- Presencia ---------------------------------------------------------------

export interface WorkerPresence {
  workerId: string
  name: string
  /** Lunes de cada semana trabajada → hoteles de esa semana. */
  weeks: Map<string, Set<string>>
  /** Lunes de su primera semana trabajada: su ingreso. */
  firstWeek: string
  lastWeek: string
}

export function buildPresence(
  timesheets: TimesheetApi[],
  hotelOfRequisition: Map<string, string>,
): Map<string, WorkerPresence> {
  const presence = new Map<string, WorkerPresence>()
  for (const sheet of timesheets) {
    const week = mondayOf(sheet.weekStart)
    const entry = presence.get(sheet.worker.id) ?? {
      workerId: sheet.worker.id,
      name: sheet.worker.fullName,
      weeks: new Map<string, Set<string>>(),
      firstWeek: week,
      lastWeek: week,
    }
    const hotels = entry.weeks.get(week) ?? new Set<string>()
    const hotel = hotelOfRequisition.get(sheet.requisitionId)
    if (hotel) hotels.add(hotel)
    entry.weeks.set(week, hotels)
    if (week < entry.firstWeek) entry.firstWeek = week
    if (week > entry.lastWeek) entry.lastWeek = week
    presence.set(sheet.worker.id, entry)
  }
  return presence
}

// --- Qué pasó con una cohorte ----------------------------------------------

/**
 * Qué pasó con quien ya no está trabajando, según su estado actual del
 * Semáforo del Colaborador.
 */
export type CohortOutcome =
  | 'ACTIVE'
  | 'STAND_BY'
  | 'RELEASED'
  | 'NO_SHOW'
  | 'REPORTED'
  | 'ACCIDENT'
  | 'BLACKLIST'
  | 'ASSIGNED_NOT_WORKING'
  | 'OTHER'

export const COHORT_OUTCOMES: CohortOutcome[] = [
  'STAND_BY',
  'RELEASED',
  'NO_SHOW',
  'REPORTED',
  'ACCIDENT',
  'BLACKLIST',
  'ASSIGNED_NOT_WORKING',
  'OTHER',
]

export const COHORT_OUTCOME_LABEL: Record<CohortOutcome, MessageDescriptor> = {
  ACTIVE: msg`Sigue trabajando`,
  STAND_BY: msg`El hotel lo mandó a descansar (Stand-by)`,
  RELEASED: msg`Sin asignación: terminó o lo liberaron`,
  NO_SHOW: msg`No regresó`,
  REPORTED: msg`Reportado por el hotel`,
  ACCIDENT: msg`Accidentado`,
  BLACKLIST: msg`Blacklist`,
  ASSIGNED_NOT_WORKING: msg`Asignado, pero sin ponches recientes`,
  OTHER: msg`Otro`,
}

const OUTCOME_OF_STATE: Record<string, CohortOutcome> = {
  PINK: 'STAND_BY',
  STRONG_GREEN: 'RELEASED',
  YELLOW: 'RELEASED',
  PURPLE: 'NO_SHOW',
  RED: 'REPORTED',
  GRAY: 'ACCIDENT',
  BLACK: 'BLACKLIST',
  APPLE_GREEN: 'ASSIGNED_NOT_WORKING',
  LIGHT_BLUE: 'ASSIGNED_NOT_WORKING',
  ORANGE: 'ASSIGNED_NOT_WORKING',
  BROWN: 'ASSIGNED_NOT_WORKING',
}

/** Estados cuyo motivo vale la pena leer del historial. */
export const STATES_WITH_REASON = new Set(['PINK', 'RED'])

export interface CohortMember {
  workerId: string
  name: string
  /** Hoteles de su semana de ingreso. */
  hotels: string[]
  weeksWorked: number
  lastWeek: string
  stateCode: string | null
  outcome: CohortOutcome
}

export interface CohortDetail {
  week: string
  members: CohortMember[]
  /** `null` si la semana siguiente todavía no empieza. */
  returnedNextWeek: number | null
  /**
   * Trabajaron esta semana o la pasada, contando solo semanas posteriores a
   * su ingreso (si no, la cohorte de la semana pasada saldría siempre al 100%).
   */
  active: number
}

export function cohortDetail(
  presence: Map<string, WorkerPresence>,
  week: string,
  currentWeek: string,
  workers: Map<string, WorkerApi>,
): CohortDetail {
  const nextWeek = addWeeks(week, 1)
  const previousWeek = addWeeks(currentWeek, -1)
  let returnedNextWeek = 0
  let active = 0
  const members: CohortMember[] = []

  for (const entry of presence.values()) {
    if (entry.firstWeek !== week) continue
    if (entry.weeks.has(nextWeek)) returnedNextWeek += 1
    const recent = [previousWeek, currentWeek].filter((candidate) => candidate > week)
    const isActive = recent.length === 0 || recent.some((candidate) => entry.weeks.has(candidate))
    if (isActive) active += 1
    const stateCode = workers.get(entry.workerId)?.state.code ?? null
    members.push({
      workerId: entry.workerId,
      name: entry.name,
      hotels: [...(entry.weeks.get(week) ?? [])].sort(),
      weeksWorked: entry.weeks.size,
      lastWeek: entry.lastWeek,
      stateCode,
      outcome: isActive
        ? 'ACTIVE'
        : ((stateCode ? OUTCOME_OF_STATE[stateCode] : undefined) ?? 'OTHER'),
    })
  }

  members.sort((a, b) => a.name.localeCompare(b.name))
  return {
    week,
    members,
    returnedNextWeek: nextWeek <= currentWeek ? returnedNextWeek : null,
    active,
  }
}

/** Ingresos por semana, de la más reciente a la más vieja. */
export function cohortSizes(
  presence: Map<string, WorkerPresence>,
  currentWeek: string,
  weeks: number,
): Array<{ week: string; size: number }> {
  const sizes = new Map<string, number>()
  for (const entry of presence.values()) {
    sizes.set(entry.firstWeek, (sizes.get(entry.firstWeek) ?? 0) + 1)
  }
  return Array.from({ length: weeks }, (_, index) => {
    const week = addWeeks(currentWeek, -index)
    return { week, size: sizes.get(week) ?? 0 }
  })
}

// --- Retención por cohorte ---------------------------------------------------

export type Granularity = 'week' | 'month'

export interface RetentionRow {
  /** Lunes (semanal) o `AAAA-MM` (mensual) del ingreso. */
  cohort: string
  size: number
  /** `cells[k]`: fracción que trabajó k semanas/meses después; `partial` = periodo en curso. */
  cells: Array<{ share: number; count: number; partial: boolean }>
}

/**
 * La tabla clásica de cohortes: cada fila, quienes ingresaron en ese periodo;
 * cada columna, qué parte trabajó k periodos después.
 */
export function retentionTable(
  presence: Map<string, WorkerPresence>,
  granularity: Granularity,
  currentWeek: string,
  rows: number,
): RetentionRow[] {
  const current = granularity === 'week' ? currentWeek : monthOf(currentWeek)
  const keyOf = (week: string): string => (granularity === 'week' ? week : monthOf(week))
  const shift = (cohort: string, k: number): string =>
    granularity === 'week' ? addWeeks(cohort, k) : addMonths(cohort, k)
  const span = (cohort: string): number =>
    granularity === 'week' ? weeksBetween(cohort, current) : monthsBetween(cohort, current)

  const groups = new Map<string, Array<Set<string>>>()
  for (const entry of presence.values()) {
    const cohort = keyOf(entry.firstWeek)
    const periods = new Set([...entry.weeks.keys()].map(keyOf))
    const list = groups.get(cohort) ?? []
    list.push(periods)
    groups.set(cohort, list)
  }

  return Array.from({ length: rows }, (_, index) => shift(current, -index))
    .map((cohort) => {
      const members = groups.get(cohort) ?? []
      return {
        cohort,
        size: members.length,
        cells: Array.from({ length: span(cohort) + 1 }, (_, k) => {
          const target = shift(cohort, k)
          const count = members.filter((periods) => periods.has(target)).length
          return {
            count,
            share: members.length === 0 ? 0 : count / members.length,
            partial: target === current,
          }
        }),
      }
    })
    .filter((row) => row.size > 0)
}

/**
 * Retención a k semanas, sumando todas las cohortes de `cohorts` cuya semana
 * +k ya terminó. `null` si ninguna llega todavía.
 */
export function retentionAt(
  presence: Map<string, WorkerPresence>,
  k: number,
  currentWeek: string,
  cohorts: number,
): { part: number; whole: number } | null {
  const oldest = addWeeks(currentWeek, -cohorts)
  let part = 0
  let whole = 0
  for (const entry of presence.values()) {
    if (entry.firstWeek < oldest) continue
    const target = addWeeks(entry.firstWeek, k)
    if (target >= currentWeek) continue
    whole += 1
    if (entry.weeks.has(target)) part += 1
  }
  return whole === 0 ? null : { part, whole }
}
