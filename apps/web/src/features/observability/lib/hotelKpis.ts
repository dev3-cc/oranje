import { msg } from '@lingui/core/macro'

import type { StatusLightSummary } from '../types/observability.types'

import { averageOf, type Kpi, ratioOf } from './kpi'
import { daysBetween, hoursBetween, isInPeriod, type Period } from './period'
import { stateAvgHours } from './statusLights'

import type { RequisitionApi } from '@/shared/types/apiContract.types'

export interface HotelInput {
  period: Period
  /** Con las eliminadas (`includeDeleted`): la cancelación se cuenta sobre ellas. */
  requisitions: RequisitionApi[]
  /** Semanas de timesheet enviadas y sin aprobar (`PENDING_APPROVAL`), de todos los hoteles. */
  pendingWeeks: number
  weekApproval: StatusLightSummary | undefined
  worker: StatusLightSummary | undefined
}

/** El primer día que pide la requisición: la `startDate` más temprana de sus posiciones. */
export function firstStartDate(requisition: RequisitionApi): string | null {
  const dates = requisition.positions.map((position) => position.startDate.slice(0, 10)).sort()
  return dates[0] ?? null
}

export function hotelKpis(input: HotelInput): Kpi[] {
  const { period, requisitions } = input

  const authorized = requisitions.filter((requisition) =>
    isInPeriod(requisition.authorizedAt, period),
  )
  const authorizeHours = authorized.map((requisition) =>
    hoursBetween(requisition.createdAt, requisition.authorizedAt as string),
  )

  const created = requisitions.filter((requisition) => isInPeriod(requisition.createdAt, period))
  const leadDays = created.flatMap((requisition) => {
    const start = firstStartDate(requisition)
    return start ? [daysBetween(requisition.createdAt, start)] : []
  })
  const cancelled = created.filter((requisition) => requisition.state.code === 'PURPLE')

  const approveHours = input.weekApproval?.span?.avgHours ?? null
  const standByHours = stateAvgHours(input.worker, 'PINK')

  return [
    {
      id: 'hotelAuthorizeHours',
      label: msg`Tiempo para autorizar`,
      hint: msg`De que se crea la requisición a que el hotel la autoriza, de las autorizadas en el periodo.`,
      format: 'hours',
      scope: 'PERIOD',
      ...averageOf(authorizeHours),
    },
    {
      id: 'hotelLeadTime',
      label: msg`Anticipación`,
      hint: msg`Días entre que se crea la requisición y su primer día de trabajo, de las creadas en el periodo.`,
      format: 'days',
      scope: 'PERIOD',
      ...averageOf(leadDays),
    },
    {
      id: 'hotelCancelled',
      label: msg`Requisiciones eliminadas`,
      hint: msg`Requisiciones creadas en el periodo que hoy están eliminadas. No incluye las modificadas.`,
      format: 'percent',
      scope: 'PERIOD',
      ...ratioOf(cancelled.length, created.length),
    },
    {
      id: 'hotelUnapprovedWeeks',
      label: msg`Semanas sin aprobar`,
      hint: msg`Semanas de timesheet que el hotel recibió y todavía no aprueba.`,
      format: 'count',
      scope: 'NOW',
      value: input.pendingWeeks,
    },
    {
      id: 'hotelApproveHours',
      label: msg`Tiempo para aprobar el timesheet`,
      hint: msg`Promedio de horas para aprobar una semana, de todo el histórico.`,
      format: 'hours',
      scope: 'ALL_TIME',
      value: approveHours,
      ...(approveHours === null ? { empty: 'NO_DATA' as const } : {}),
      approximate: true,
    },
    {
      id: 'hotelStandBy',
      label: msg`Tiempo en Stand-by`,
      hint: msg`Promedio que un colaborador pasa en Stand-by, de todo el histórico.`,
      format: 'days',
      scope: 'ALL_TIME',
      value: standByHours === null ? null : standByHours / 24,
      ...(standByHours === null ? { empty: 'NO_DATA' as const } : {}),
      approximate: true,
    },
  ]
}
