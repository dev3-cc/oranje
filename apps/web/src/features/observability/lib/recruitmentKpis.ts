import { msg } from '@lingui/core/macro'

import type { Punch, StatusLightSummary } from '../types/observability.types'

import { firstStartDate } from './hotelKpis'
import { type Kpi, ratioOf } from './kpi'
import { dayIso, isInPeriod, localDay, type Period } from './period'
import { stateAvgHours } from './statusLights'

import type { AssignmentApi, RequisitionApi, WorkerApi } from '@/shared/types/apiContract.types'

/** Fuera del cálculo de cobertura: en elaboración y eliminadas. */
const NOT_STAFFING = new Set(['APPLE_GREEN', 'PURPLE'])
/** Autorizada o en proceso: todavía se están llenando. */
const FILLING = new Set(['GREEN', 'YELLOW'])

/** Tope de requisiciones para el no-show: cada una es una llamada a sus asignaciones. */
export const DAY_ONE_MAX_REQUISITIONS = 40

/**
 * Las requisiciones cuyo primer día de alguien pudo caer en el periodo: ya
 * empezaron, y empezaron en el periodo o se movieron en él (una asignación
 * nueva cambia `filled`). Las más recientes primero, con tope.
 */
export function dayOneCandidates(requisitions: RequisitionApi[], period: Period): RequisitionApi[] {
  const from = dayIso(period.from)
  const today = dayIso(period.to)
  return requisitions
    .filter((requisition) => !NOT_STAFFING.has(requisition.state.code))
    .flatMap((requisition) => {
      const start = firstStartDate(requisition)
      if (!start || start > today) return []
      const moved = start >= from || isInPeriod(requisition.updatedAt, period)
      return moved ? [{ requisition, start }] : []
    })
    .sort((a, b) => b.start.localeCompare(a.start))
    .slice(0, DAY_ONE_MAX_REQUISITIONS)
    .map(({ requisition }) => requisition)
}

export interface DayOneRequisition {
  requisition: RequisitionApi
  assignments: AssignmentApi[]
}

/**
 * No-show del día 1: de cada persona asignada, su primer día es el más tardío
 * entre el inicio de la requisición y el día en que se le asignó. Si ese día
 * cayó en el periodo y ya terminó, y no tiene ningún ponche ese día en ese
 * hotel, no se presentó. Aproximado: no sabe de turnos ni de días de descanso.
 */
export function dayOneNoShow(
  items: DayOneRequisition[],
  punches: Punch[],
  period: Period,
): { expected: number; noShows: number } {
  const punchedDays = new Set(
    punches.map(
      (punch) =>
        `${punch.workerId}|${punch.hotelId}|${localDay(punch.serverAt, punch.hotelTimeZone)}`,
    ),
  )
  const from = dayIso(period.from)
  let expected = 0
  let noShows = 0

  for (const { requisition, assignments } of items) {
    const start = firstStartDate(requisition)
    if (!start) continue
    const timeZone = requisition.hotel.timeZone
    const today = localDay(period.to.toISOString(), timeZone)

    for (const assignment of assignments) {
      if (assignment.status === 'CANCELLED') continue
      const assignedOn = localDay(assignment.createdAt, timeZone)
      const firstDay = assignedOn > start ? assignedOn : start
      if (firstDay < from || firstDay >= today) continue
      expected += 1
      if (!punchedDays.has(`${assignment.worker.id}|${requisition.hotel.id}|${firstDay}`)) {
        noShows += 1
      }
    }
  }

  return { expected, noShows }
}

export interface RecruitmentInput {
  period: Period
  requisitions: RequisitionApi[]
  workers: WorkerApi[]
  requisitionLight: StatusLightSummary | undefined
  /** `null` mientras se calcula o si falló: la tarjeta lo dice. */
  dayOne: { expected: number; noShows: number } | null
}

export function recruitmentKpis(input: RecruitmentInput): Kpi[] {
  const { period, requisitions } = input
  const today = dayIso(period.to)
  const from = dayIso(period.from)

  const startingInPeriod = requisitions.filter((requisition) => {
    if (NOT_STAFFING.has(requisition.state.code)) return false
    const start = firstStartDate(requisition)
    return start !== null && start >= from && start <= today
  })
  const slots = startingInPeriod.reduce((sum, requisition) => sum + requisition.totalSlots, 0)
  const filled = startingInPeriod.reduce((sum, requisition) => sum + requisition.filledSlots, 0)

  const urgentOpen = requisitions
    .filter((requisition) => FILLING.has(requisition.state.code))
    .flatMap((requisition) => requisition.positions)
    .filter((position) => position.urgency?.code === 'RED' && position.filled < position.quantity)

  const authorizedHours = stateAvgHours(input.requisitionLight, 'GREEN')
  const inProcessHours = stateAvgHours(input.requisitionLight, 'YELLOW')
  const timeToFillHours =
    authorizedHours === null && inProcessHours === null
      ? null
      : (authorizedHours ?? 0) + (inProcessHours ?? 0)

  const intake = input.workers.filter((worker) => isInPeriod(worker.createdAt, period))

  return [
    {
      id: 'recruitmentFillRate',
      label: msg`Fill rate`,
      hint: msg`Lugares cubiertos sobre lugares pedidos, de las requisiciones que empiezan en el periodo.`,
      format: 'percent',
      scope: 'PERIOD',
      ...ratioOf(filled, slots),
    },
    {
      id: 'recruitmentNoShow',
      label: msg`No-show del día 1`,
      hint: msg`Personas asignadas que no ponchan su primer día, con el primer día en el periodo.`,
      format: 'percent',
      scope: 'PERIOD',
      approximate: true,
      ...(input.dayOne
        ? ratioOf(input.dayOne.noShows, input.dayOne.expected)
        : { value: null, empty: 'NO_DATA' as const }),
    },
    {
      id: 'recruitmentPoolIntake',
      label: msg`Ingreso al Pool`,
      hint: msg`Colaboradores dados de alta en el periodo.`,
      format: 'count',
      scope: 'PERIOD',
      value: intake.length,
    },
    {
      id: 'recruitmentUrgentOpen',
      label: msg`Posiciones urgentes sin cubrir`,
      hint: msg`Posiciones con urgencia roja y lugares vacíos, en requisiciones que se están llenando.`,
      format: 'count',
      scope: 'NOW',
      value: urgentOpen.length,
    },
    {
      id: 'recruitmentTimeToFill',
      label: msg`Time-to-fill`,
      hint: msg`Promedio en Autorizada más promedio en En proceso, de todo el histórico.`,
      format: 'days',
      scope: 'ALL_TIME',
      value: timeToFillHours === null ? null : timeToFillHours / 24,
      ...(timeToFillHours === null ? { empty: 'NO_DATA' as const } : {}),
      approximate: true,
    },
  ]
}
