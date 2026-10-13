import { Injectable } from '@nestjs/common'

import {
  ApprovalTimelinessRepository,
  ManagerRow,
  TimelinessRawRow,
} from './approval-timeliness.repository.js'

/**
 * KPI 4 · Aprobación oportuna de ponches (Métricas y KPIs por Departamento).
 *
 *   (ponches de semanas aprobadas antes del cierre / total de ponches del periodo) × 100
 *
 * Una sola fuente de cálculo: la consumen Observabilidad y Contabilidad. No
 * vive en ninguna pantalla.
 */

export const TIMELINESS_THRESHOLDS = { green: 95, yellow: 85 } as const

export type TimelinessLevel = 'GREEN' | 'YELLOW' | 'RED'

export interface TimelinessTotals {
  timesheets: { total: number; onTime: number; late: number; pending: number }
  punches: {
    total: number
    onTime: number
    percentage: number | null
    level: TimelinessLevel | null
  }
  /** Promedio de días de atraso de las semanas que NO se aprobaron a tiempo. */
  avgDaysLate: number | null
}

export interface TimelinessByManager extends TimelinessTotals {
  hotelId: string
  hotelName: string
  departmentId: string | null
  departmentName: string | null
  managers: Array<{ id: string; fullName: string }>
}

export interface TimelinessByHotel extends TimelinessTotals {
  hotelId: string
  hotelName: string
}

export interface ApprovalTimeliness {
  weeks: number
  thresholds: { green: number; yellow: number }
  overall: TimelinessTotals
  byHotel: TimelinessByHotel[]
  byManager: TimelinessByManager[]
}

/** Umbral sobre el porcentaje ya redondeado a un decimal: lo que se ve es lo que se clasifica. */
export function levelOf(percentage: number | null): TimelinessLevel | null {
  if (percentage === null) return null
  if (percentage >= TIMELINESS_THRESHOLDS.green) return 'GREEN'
  if (percentage >= TIMELINESS_THRESHOLDS.yellow) return 'YELLOW'
  return 'RED'
}

export function percentageOf(onTime: number, total: number): number | null {
  if (total === 0) return null
  return Math.round((onTime / total) * 1000) / 10
}

interface Sums {
  timesheetsTotal: number
  timesheetsOnTime: number
  timesheetsLate: number
  timesheetsPending: number
  punchesTotal: number
  punchesOnTime: number
  lateDaysSum: number
  lateCount: number
}

function totalsOf(sums: Sums): TimelinessTotals {
  const percentage = percentageOf(sums.punchesOnTime, sums.punchesTotal)

  return {
    timesheets: {
      total: sums.timesheetsTotal,
      onTime: sums.timesheetsOnTime,
      late: sums.timesheetsLate,
      pending: sums.timesheetsPending,
    },
    punches: {
      total: sums.punchesTotal,
      onTime: sums.punchesOnTime,
      percentage,
      level: levelOf(percentage),
    },
    avgDaysLate:
      sums.lateCount > 0 ? Math.round((sums.lateDaysSum / sums.lateCount) * 10) / 10 : null,
  }
}

function sumOf(rows: TimelinessRawRow[]): Sums {
  return rows.reduce<Sums>(
    (acc, row) => ({
      timesheetsTotal: acc.timesheetsTotal + row.timesheetsTotal,
      timesheetsOnTime: acc.timesheetsOnTime + row.timesheetsOnTime,
      timesheetsLate: acc.timesheetsLate + row.timesheetsLate,
      timesheetsPending: acc.timesheetsPending + row.timesheetsPending,
      punchesTotal: acc.punchesTotal + row.punchesTotal,
      punchesOnTime: acc.punchesOnTime + row.punchesOnTime,
      lateDaysSum: acc.lateDaysSum + row.lateDaysSum,
      lateCount: acc.lateCount + row.lateCount,
    }),
    {
      timesheetsTotal: 0,
      timesheetsOnTime: 0,
      timesheetsLate: 0,
      timesheetsPending: 0,
      punchesTotal: 0,
      punchesOnTime: 0,
      lateDaysSum: 0,
      lateCount: 0,
    },
  )
}

@Injectable()
export class ApprovalTimelinessService {
  constructor(private readonly repo: ApprovalTimelinessRepository) {}

  /** `weeks`: cuántas semanas hacia atrás (contando desde hoy) entran al periodo. */
  async compute(weeks: number): Promise<ApprovalTimeliness> {
    const [rows, managers] = await Promise.all([this.repo.rows(weeks * 7), this.repo.managers()])

    return {
      weeks,
      thresholds: { ...TIMELINESS_THRESHOLDS },
      overall: totalsOf(sumOf(rows)),
      byHotel: groupByHotel(rows),
      byManager: rows.map((row) => ({
        hotelId: row.hotelId,
        hotelName: row.hotelName,
        departmentId: row.departmentId,
        departmentName: row.departmentName,
        managers: managersOf(managers, row.hotelId, row.departmentId),
        ...totalsOf(sumOf([row])),
      })),
    }
  }
}

function managersOf(
  managers: ManagerRow[],
  hotelId: string,
  departmentId: string | null,
): Array<{ id: string; fullName: string }> {
  return managers
    .filter((m) => m.hotelId === hotelId && m.departmentId === departmentId)
    .map((m) => ({ id: m.id, fullName: m.fullName }))
}

function groupByHotel(rows: TimelinessRawRow[]): TimelinessByHotel[] {
  const byId = new Map<string, { hotelName: string; rows: TimelinessRawRow[] }>()

  for (const row of rows) {
    const group = byId.get(row.hotelId) ?? { hotelName: row.hotelName, rows: [] }
    group.rows.push(row)
    byId.set(row.hotelId, group)
  }

  return [...byId.entries()]
    .map(([hotelId, group]) => ({
      hotelId,
      hotelName: group.hotelName,
      ...totalsOf(sumOf(group.rows)),
    }))
    .sort((a, b) => a.hotelName.localeCompare(b.hotelName))
}
