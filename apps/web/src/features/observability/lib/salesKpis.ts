import { msg } from '@lingui/core/macro'

import type { StatusLightSummary } from '../types/observability.types'

import { type Kpi, ratioOf } from './kpi'
import { daysAgo, isInPeriod, type Period } from './period'

import type {
  ContactAttemptApi,
  HotelApi,
  ProspectApi,
  RequisitionApi,
} from '@/shared/types/apiContract.types'

/** El mismo criterio que el tablero de Ventas (`dashboardApi.ts`). */
export const STALE_DAYS = 7
const NO_REQUISITION_DAYS = 90

export interface SalesInput {
  period: Period
  prospects: ProspectApi[]
  attempts: ContactAttemptApi[]
  clientHotels: HotelApi[]
  requisitions: RequisitionApi[]
  onboarding: StatusLightSummary | undefined
}

/**
 * Ventas. Conversión con la definición del tablero de Ventas: ciclos que
 * llegaron a NARANJA sobre ciclos terminados, pero solo los que terminaron en
 * el periodo (el `stateSince` de NARANJA es la conversión).
 */
export function salesKpis(input: SalesInput): Kpi[] {
  const { period, prospects, attempts } = input

  const converted = prospects.filter(
    (prospect) => prospect.state.code === 'ORANGE' && isInPeriod(prospect.stateSince, period),
  )
  const closed = prospects.filter(
    (prospect) => prospect.state.code !== 'ORANGE' && isInPeriod(prospect.closedAt, period),
  )
  const lost = closed.filter((prospect) => prospect.state.code === 'RED')
  const finished = converted.length + closed.length

  const staleSince = daysAgo(STALE_DAYS, period.to).getTime()
  const open = prospects.filter((prospect) => prospect.isOpen)
  const stale = open.filter(
    (prospect) =>
      new Date(prospect.lastAttempt?.occurredAt ?? prospect.openedAt).getTime() <= staleSince,
  )

  const attemptsInPeriod = attempts.filter((attempt) => isInPeriod(attempt.occurredAt, period))
  const visits = attemptsInPeriod.filter((attempt) => attempt.attemptType === 'COLD_VISIT')
  const meetings = attemptsInPeriod.filter((attempt) => attempt.outcome === 'MEETING_SET')

  const requestedSince = daysAgo(NO_REQUISITION_DAYS, period.to).getTime()
  const recentlyRequested = new Set(
    input.requisitions
      .filter((requisition) => new Date(requisition.createdAt).getTime() >= requestedSince)
      .map((requisition) => requisition.hotel.id),
  )
  const withoutRequisition = input.clientHotels.filter((hotel) => !recentlyRequested.has(hotel.id))

  const cycleHours = input.onboarding?.total?.avgTotalHours ?? null

  return [
    {
      id: 'salesConversion',
      label: msg`Conversión`,
      hint: msg`Hoteles que pasaron a cliente sobre los ciclos que terminaron en el periodo.`,
      format: 'percent',
      scope: 'PERIOD',
      ...ratioOf(converted.length, finished),
    },
    {
      id: 'salesLoss',
      label: msg`Pérdida`,
      hint: msg`Ciclos cerrados en Rechazo sobre los ciclos que terminaron en el periodo.`,
      format: 'percent',
      scope: 'PERIOD',
      ...ratioOf(lost.length, finished),
    },
    {
      id: 'salesVisits',
      label: msg`Visitas en frío`,
      hint: msg`Visitas en frío registradas en el periodo, de todos los BD.`,
      format: 'count',
      scope: 'PERIOD',
      value: visits.length,
    },
    {
      id: 'salesMeetings',
      label: msg`Citas agendadas`,
      hint: msg`Intentos de contacto con resultado «cita agendada». No existe una entidad de cita: es una aproximación.`,
      format: 'count',
      scope: 'PERIOD',
      value: meetings.length,
      approximate: true,
    },
    {
      id: 'salesStale',
      label: msg`Prospectos estancados`,
      hint: msg`Prospectos abiertos con ${STALE_DAYS} días o más sin un intento de contacto.`,
      format: 'count',
      scope: 'NOW',
      value: stale.length,
      ratio: { part: stale.length, whole: open.length },
    },
    {
      id: 'salesHotelsWithoutRequisition',
      label: msg`Clientes sin requisitar`,
      hint: msg`Hoteles cliente sin ninguna requisición creada en los últimos ${NO_REQUISITION_DAYS} días.`,
      format: 'count',
      scope: 'NOW',
      value: withoutRequisition.length,
      ratio: { part: withoutRequisition.length, whole: input.clientHotels.length },
    },
    {
      id: 'salesOnboardingCycle',
      label: msg`Ciclo de onboarding`,
      hint: msg`Promedio de la apertura del ciclo a su cierre, de todo el histórico.`,
      format: 'days',
      scope: 'ALL_TIME',
      value: cycleHours === null ? null : cycleHours / 24,
      ...(cycleHours === null ? { empty: 'NO_DATA' as const } : {}),
    },
  ]
}
