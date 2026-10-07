import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import { firstStartDate } from './hotelKpis'
import { daysAgo, isInPeriod, type Period } from './period'
import { STALE_DAYS } from './salesKpis'

import type {
  ContactAttemptApi,
  ProspectApi,
  RequisitionApi,
  RequisitionJournalEntryApi,
} from '@/shared/types/apiContract.types'

/**
 * La actividad por persona de un departamento. Solo aparece quien dejó rastro
 * en los datos que el Observador puede leer: el personal sin actividad ni
 * cartera no se puede listar (`/users` y `/team` piden otros permisos).
 */

export type PersonEventKind =
  | 'COLD_VISIT'
  | 'CALL'
  | 'EMAIL'
  | 'CONVERTED'
  | 'RECRUITER_JOINED'
  | 'RECRUITER_LEFT'
  | 'RECRUITER_REASSIGNED'
  | 'REQUISITION_CREATED'

export const PERSON_EVENT_LABEL: Record<PersonEventKind, MessageDescriptor> = {
  COLD_VISIT: msg`Visita en frío`,
  CALL: msg`Llamada`,
  EMAIL: msg`Correo`,
  CONVERTED: msg`Hotel convertido en cliente`,
  RECRUITER_JOINED: msg`Tomó la requisición`,
  RECRUITER_LEFT: msg`Soltó la requisición`,
  RECRUITER_REASSIGNED: msg`Reasignó la requisición`,
  REQUISITION_CREATED: msg`Creó la requisición`,
}

export interface PersonEvent {
  at: string
  kind: PersonEventKind
  /** De qué: el hotel o la requisición. */
  subject: string
  /** Resultado del intento de contacto, si aplica (código crudo). */
  outcome?: string
}

export interface PersonMetric {
  label: MessageDescriptor
  value: number
}

export interface PersonRow {
  key: string
  name: string
  /** `ROL-…`; `null` si la fuente no lo dice. */
  roleCode: string | null
  /** Los primeros van en la tabla; todos en el detalle. */
  metrics: PersonMetric[]
  /** Última acción registrada en el periodo; `null` = nada en el periodo. */
  lastActivityAt: string | null
  /** Del más reciente al más viejo, solo los del periodo. */
  events: PersonEvent[]
}

interface Draft {
  key: string
  name: string
  roleCode: string | null
  counts: Map<string, number>
  events: PersonEvent[]
}

function draftOf(
  map: Map<string, Draft>,
  key: string,
  name: string,
  roleCode: string | null,
): Draft {
  const existing = map.get(key)
  if (existing) return existing
  const draft: Draft = { key, name, roleCode, counts: new Map(), events: [] }
  map.set(key, draft)
  return draft
}

function bump(draft: Draft, metric: string, by = 1): void {
  draft.counts.set(metric, (draft.counts.get(metric) ?? 0) + by)
}

function finish(
  drafts: Map<string, Draft>,
  metrics: Array<{ id: string; label: MessageDescriptor }>,
): PersonRow[] {
  return [...drafts.values()]
    .map((draft) => {
      const events = [...draft.events].sort((a, b) => b.at.localeCompare(a.at))
      return {
        key: draft.key,
        name: draft.name,
        roleCode: draft.roleCode,
        metrics: metrics.map(({ id, label }) => ({ label, value: draft.counts.get(id) ?? 0 })),
        lastActivityAt: events[0]?.at ?? null,
        events,
      }
    })
    .sort(byLeastActive)
}

/** Primero quien no hizo nada en el periodo; luego de la actividad más vieja a la más reciente. */
export function byLeastActive(a: PersonRow, b: PersonRow): number {
  if (a.lastActivityAt === b.lastActivityAt) return a.name.localeCompare(b.name)
  if (a.lastActivityAt === null) return -1
  if (b.lastActivityAt === null) return 1
  return a.lastActivityAt.localeCompare(b.lastActivityAt)
}

// --- Ventas ------------------------------------------------------------------

export type ProspectAttempt = ContactAttemptApi & { prospectId: string }

const SALES_METRICS = [
  { id: 'open', label: msg`Prospectos abiertos` },
  { id: 'stale', label: msg`Estancados` },
  { id: 'attempts', label: msg`Intentos` },
  { id: 'meetings', label: msg`Citas` },
  { id: 'converted', label: msg`Conversiones` },
  { id: 'COLD_VISIT', label: msg`Visitas en frío` },
  { id: 'CALL', label: msg`Llamadas` },
  { id: 'EMAIL', label: msg`Correos` },
]

/**
 * Cada BD o BDC: su cartera (dueño del prospecto) y lo que registró en el
 * periodo (quien registra el intento). Las conversiones se le cuentan al
 * dueño del prospecto.
 */
export function salesPeople(input: {
  period: Period
  prospects: ProspectApi[]
  attempts: ProspectAttempt[]
}): PersonRow[] {
  const { period } = input
  const drafts = new Map<string, Draft>()
  const hotelOf = new Map(input.prospects.map((prospect) => [prospect.id, prospect.hotel.name]))
  const staleSince = daysAgo(STALE_DAYS, period.to).getTime()

  for (const prospect of input.prospects) {
    const draft = draftOf(drafts, prospect.owner.id, prospect.owner.fullName, null)
    if (prospect.isOpen) {
      bump(draft, 'open')
      const last = new Date(prospect.lastAttempt?.occurredAt ?? prospect.openedAt).getTime()
      if (last <= staleSince) bump(draft, 'stale')
    }
    if (prospect.state.code === 'ORANGE' && isInPeriod(prospect.stateSince, period)) {
      bump(draft, 'converted')
      draft.events.push({
        at: prospect.stateSince,
        kind: 'CONVERTED',
        subject: prospect.hotel.name,
      })
    }
  }

  for (const attempt of input.attempts) {
    if (!isInPeriod(attempt.occurredAt, period)) continue
    const draft = draftOf(drafts, attempt.user.id, attempt.user.fullName, null)
    bump(draft, 'attempts')
    bump(draft, attempt.attemptType)
    if (attempt.outcome === 'MEETING_SET') bump(draft, 'meetings')
    draft.events.push({
      at: attempt.occurredAt,
      kind: attempt.attemptType as PersonEventKind,
      subject: hotelOf.get(attempt.prospectId) ?? '—',
      outcome: attempt.outcome,
    })
  }

  return finish(drafts, SALES_METRICS)
}

// --- Reclutamiento -----------------------------------------------------------

const RECRUITER_EVENTS = new Set(['RECRUITER_JOINED', 'RECRUITER_LEFT', 'RECRUITER_REASSIGNED'])
/** Se está llenando: quien la tiene tomada todavía trabaja en ella. */
const FILLING = new Set(['GREEN', 'YELLOW'])

/** Tope de bitácoras por consulta: una llamada por requisición. */
export const JOURNAL_MAX_REQUISITIONS = 60

/**
 * Las requisiciones cuya bitácora pudo moverse en el periodo: las que se
 * están llenando y las que cambiaron en él. Las más recientes primero.
 */
export function journalCandidates(
  requisitions: RequisitionApi[],
  period: Period,
): { ids: string[]; capped: boolean } {
  const moved = requisitions
    .filter(
      (requisition) =>
        FILLING.has(requisition.state.code) ||
        isInPeriod(requisition.updatedAt ?? requisition.createdAt, period),
    )
    .filter((requisition) => requisition.state.code !== 'APPLE_GREEN')
    .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
  return {
    ids: moved.slice(0, JOURNAL_MAX_REQUISITIONS).map((requisition) => requisition.id),
    capped: moved.length > JOURNAL_MAX_REQUISITIONS,
  }
}

const RECRUITMENT_METRICS = [
  { id: 'holding', label: msg`Requisiciones a su cargo` },
  { id: 'joined', label: msg`Tomadas` },
  { id: 'left', label: msg`Soltadas` },
  { id: 'reassigned', label: msg`Reasignadas` },
  { id: 'slotsOpen', label: msg`Lugares por cubrir en las suyas` },
]

/**
 * Cada reclutador según la bitácora de las requisiciones. La bitácora trae el
 * nombre y el rol de quien actuó, no su id: se agrupa por nombre y rol. «A su
 * cargo» = su último movimiento en una requisición que se está llenando fue
 * tomarla. La asignación de colaboradores se registra en otra bitácora que el
 * Observador no lee, así que no aparece aquí.
 */
export function recruitmentPeople(input: {
  period: Period
  requisitions: RequisitionApi[]
  journals: Record<string, RequisitionJournalEntryApi[]>
}): PersonRow[] {
  const { period } = input
  const drafts = new Map<string, Draft>()
  const byId = new Map(input.requisitions.map((requisition) => [requisition.id, requisition]))

  for (const [requisitionId, entries] of Object.entries(input.journals)) {
    const requisition = byId.get(requisitionId)
    if (!requisition) continue
    const subject = `${requisition.number} · ${requisition.hotel.name}`
    const lastMove = new Map<string, string>()

    for (const entry of [...entries].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
      if (!RECRUITER_EVENTS.has(entry.eventType) || !entry.actorName) continue
      const key = `${entry.actorName}|${entry.actorRole ?? ''}`
      const draft = draftOf(drafts, key, entry.actorName, entry.actorRole)
      if (entry.eventType !== 'RECRUITER_REASSIGNED') lastMove.set(key, entry.eventType)
      if (!isInPeriod(entry.occurredAt, period)) continue
      bump(
        draft,
        entry.eventType === 'RECRUITER_JOINED'
          ? 'joined'
          : entry.eventType === 'RECRUITER_LEFT'
            ? 'left'
            : 'reassigned',
      )
      draft.events.push({
        at: entry.occurredAt,
        kind: entry.eventType as PersonEventKind,
        subject,
      })
    }

    if (!FILLING.has(requisition.state.code)) continue
    for (const [key, move] of lastMove) {
      if (move !== 'RECRUITER_JOINED') continue
      const draft = drafts.get(key) as Draft
      bump(draft, 'holding')
      bump(draft, 'slotsOpen', Math.max(0, requisition.totalSlots - requisition.filledSlots))
    }
  }

  return finish(drafts, RECRUITMENT_METRICS)
}

// --- Inspección --------------------------------------------------------------

const INSPECTION_METRICS = [
  { id: 'filling', label: msg`Requisiciones abiertas en su zona` },
  { id: 'urgent', label: msg`Posiciones urgentes sin cubrir` },
  { id: 'created', label: msg`Requisiciones que creó` },
  { id: 'starting', label: msg`Arrancan en el periodo` },
]

/**
 * Cada inspector según las requisiciones que tiene asignadas (`inspector`) y
 * las que creó (`createdBy`). Sus auditorías y accidentes no se ven: el
 * Observador no tiene permiso para leerlos.
 */
export function inspectionPeople(input: {
  period: Period
  requisitions: RequisitionApi[]
}): PersonRow[] {
  const { period } = input
  const drafts = new Map<string, Draft>()
  const inspectorIds = new Set<string>()
  const from = period.from.toLocaleDateString('en-CA')
  const today = period.to.toLocaleDateString('en-CA')

  for (const requisition of input.requisitions) {
    const inspector = requisition.inspector
    if (!inspector) continue
    inspectorIds.add(inspector.id)
    const draft = draftOf(drafts, inspector.id, inspector.fullName, null)
    if (FILLING.has(requisition.state.code)) {
      bump(draft, 'filling')
      bump(
        draft,
        'urgent',
        requisition.positions.filter(
          (position) => position.urgency?.code === 'RED' && position.filled < position.quantity,
        ).length,
      )
    }
    const start = firstStartDate(requisition)
    if (requisition.state.code !== 'PURPLE' && start && start >= from && start <= today) {
      bump(draft, 'starting')
    }
  }

  for (const requisition of input.requisitions) {
    const author = requisition.createdBy
    if (!author || !inspectorIds.has(author.id) || !isInPeriod(requisition.createdAt, period)) {
      continue
    }
    const draft = drafts.get(author.id) as Draft
    bump(draft, 'created')
    draft.events.push({
      at: requisition.createdAt,
      kind: 'REQUISITION_CREATED',
      subject: `${requisition.number} · ${requisition.hotel.name}`,
    })
  }

  return finish(drafts, INSPECTION_METRICS)
}
