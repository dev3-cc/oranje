import { isInPeriod, type Period } from './period'

import type {
  AssignmentApi,
  RequisitionApi,
  RequisitionJournalEntryApi,
} from '@/shared/types/apiContract.types'

/**
 * Los TIEMPOS de Reclutamiento, armados con lo que el Observador ya lee: la
 * requisición (`authorizedAt`, lugares), su bitácora (quién la tomó o soltó y
 * cuándo) y sus asignaciones (cuándo entró cada persona).
 *
 * Lo que no se puede saber sin el back: QUIÉN hizo cada asignación — la lista
 * de asignaciones no lo trae y su bitácora el Observador no la lee. Por eso, a
 * una reclutadora se le cuentan las asignaciones que ocurrieron mientras ella
 * tenía la requisición; si eran varias, a cada una (aproximado).
 */

const HOUR_MS = 3_600_000

export function hoursBetween(fromIso: string, toIso: string): number {
  return (new Date(toIso).getTime() - new Date(fromIso).getTime()) / HOUR_MS
}

/** Las asignaciones que cuentan (todas menos las canceladas), de la más vieja a la más nueva. */
function counted(assignments: AssignmentApi[]): AssignmentApi[] {
  return assignments
    .filter((assignment) => assignment.status !== 'CANCELLED')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

function byTime(entries: RequisitionJournalEntryApi[]): RequisitionJournalEntryApi[] {
  return [...entries].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
}

/** La primera vez que una reclutadora tomó la requisición. */
export function firstTakeAt(entries: RequisitionJournalEntryApi[]): string | null {
  return byTime(entries).find((entry) => entry.eventType === 'RECRUITER_JOINED')?.occurredAt ?? null
}

/**
 * Cuándo se llenó el último lugar: la asignación que completó `totalSlots`.
 * `null` si hoy no está cubierta al 100%. Aproximado: una persona que se fue y
 * se reemplazó cuenta como si el lugar se hubiera llenado al reemplazarla.
 */
export function coveredAt(
  requisition: RequisitionApi,
  assignments: AssignmentApi[],
): string | null {
  if (requisition.totalSlots <= 0 || requisition.filledSlots < requisition.totalSlots) return null
  const list = counted(assignments)
  return (list[requisition.totalSlots - 1] ?? list[list.length - 1])?.createdAt ?? null
}

/** Quién tenía la requisición en un momento: la tomó y no la había soltado. Nombre → cuándo la tomó. */
export function participantsAt(
  entries: RequisitionJournalEntryApi[],
  at: string,
): Map<string, string> {
  const active = new Map<string, string>()
  for (const entry of byTime(entries)) {
    if (entry.occurredAt > at) break
    if (!entry.actorName) continue
    if (entry.eventType === 'RECRUITER_JOINED' && !active.has(entry.actorName)) {
      active.set(entry.actorName, entry.occurredAt)
    } else if (entry.eventType === 'RECRUITER_LEFT') {
      active.delete(entry.actorName)
    }
  }
  return active
}

export interface TimingInput {
  requisitions: RequisitionApi[]
  journals: Record<string, RequisitionJournalEntryApi[]>
  assignments: Record<string, AssignmentApi[]>
}

function averageOrNull(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length
}

export interface RecruitmentTimes {
  /** Horas de autorizada a que alguien la tomó, de las autorizadas en el periodo. */
  attentionHours: number | null
  attentionCount: number
  /** Autorizadas en el periodo que nadie ha tomado todavía. */
  untaken: number
  /** Días de autorizada a cubierta al 100%, de las cubiertas en el periodo. */
  fillDays: number | null
  fillCount: number
  /** Días de que la tomaron a cada asignación, de las asignaciones del periodo. */
  perPersonDays: number | null
  perPersonCount: number
}

/** Los tiempos del departamento en el periodo. Solo de las requisiciones con bitácora y asignaciones. */
export function recruitmentTimes(input: TimingInput, period: Period): RecruitmentTimes {
  const attention: number[] = []
  const fill: number[] = []
  const perPerson: number[] = []
  let untaken = 0

  for (const requisition of input.requisitions) {
    const entries = input.journals[requisition.id]
    const assignments = input.assignments[requisition.id]
    if (!entries || !assignments || !requisition.authorizedAt) continue
    const authorizedAt = requisition.authorizedAt
    const takenAt = firstTakeAt(entries)

    if (isInPeriod(authorizedAt, period)) {
      if (takenAt && takenAt >= authorizedAt) attention.push(hoursBetween(authorizedAt, takenAt))
      else if (!takenAt) untaken += 1
    }

    const covered = coveredAt(requisition, assignments)
    if (covered && covered >= authorizedAt && isInPeriod(covered, period)) {
      fill.push(hoursBetween(authorizedAt, covered) / 24)
    }

    if (!takenAt) continue
    for (const assignment of counted(assignments)) {
      if (!isInPeriod(assignment.createdAt, period) || assignment.createdAt < takenAt) continue
      perPerson.push(hoursBetween(takenAt, assignment.createdAt) / 24)
    }
  }

  return {
    attentionHours: averageOrNull(attention),
    attentionCount: attention.length,
    untaken,
    fillDays: averageOrNull(fill),
    fillCount: fill.length,
    perPersonDays: averageOrNull(perPerson),
    perPersonCount: perPerson.length,
  }
}

export interface RecruiterTimes {
  /** Horas de autorizada a que ELLA la tomó, de lo que tomó en el periodo. */
  attentionHours: number[]
  /** Días de que ella la tomó a cada asignación mientras la tenía, en el periodo. */
  perPersonDays: number[]
}

/** Los tiempos de cada reclutadora en el periodo, por nombre (la bitácora no trae el id). */
export function recruiterTimes(input: TimingInput, period: Period): Map<string, RecruiterTimes> {
  const byName = new Map<string, RecruiterTimes>()
  const of = (name: string): RecruiterTimes => {
    const existing = byName.get(name)
    if (existing) return existing
    const created: RecruiterTimes = { attentionHours: [], perPersonDays: [] }
    byName.set(name, created)
    return created
  }

  for (const requisition of input.requisitions) {
    const entries = input.journals[requisition.id]
    if (!entries || !requisition.authorizedAt) continue
    const authorizedAt = requisition.authorizedAt

    for (const entry of entries) {
      if (entry.eventType !== 'RECRUITER_JOINED' || !entry.actorName) continue
      if (!isInPeriod(entry.occurredAt, period) || entry.occurredAt < authorizedAt) continue
      of(entry.actorName).attentionHours.push(hoursBetween(authorizedAt, entry.occurredAt))
    }

    for (const assignment of counted(input.assignments[requisition.id] ?? [])) {
      if (!isInPeriod(assignment.createdAt, period)) continue
      for (const [name, joinedAt] of participantsAt(entries, assignment.createdAt)) {
        of(name).perPersonDays.push(hoursBetween(joinedAt, assignment.createdAt) / 24)
      }
    }
  }

  return byName
}
