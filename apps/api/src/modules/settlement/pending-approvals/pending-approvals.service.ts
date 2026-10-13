import { Injectable } from '@nestjs/common'

import { PendingApprovalsRepository, PendingTimesheetRow } from './pending-approvals.repository.js'

export interface PendingApprovalWeek {
  hotelId: string
  hotelName: string
  weekStart: string
  weekEnd: string
  cutoff: string
  /** Días completos desde el cierre de la semana. Cero el día del cierre. */
  daysLate: number
  pendingTimesheets: number
  /** Un renglón por departamento con horas pendientes, con su Manager de Área. */
  responsables: Array<{
    departmentName: string | null
    managers: Array<{ id: string; fullName: string }>
  }>
}

const DAY_MS = 86_400_000

export function isoDay(value: Date): string {
  return value.toISOString().slice(0, 10)
}

export function daysSince(cutoff: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - cutoff.getTime()) / DAY_MS))
}

@Injectable()
export class PendingApprovalsService {
  constructor(private readonly repo: PendingApprovalsRepository) {}

  /**
   * Semanas de Contabilidad con horas sin aprobar. Lo que el Manager de Área
   * no aprobó no entra al Consolidado: esta lista es lo que se debe cobrar.
   */
  async list(filters: {
    hotelId?: string | undefined
    weekStart?: string | undefined
  }): Promise<PendingApprovalWeek[]> {
    const [rows, managers] = await Promise.all([
      this.repo.pending({ hotelId: filters.hotelId, weekStart: filters.weekStart }),
      this.repo.activeManagers(),
    ])

    return groupByHotelWeek(rows, managers, new Date())
  }
}

export function groupByHotelWeek(
  rows: PendingTimesheetRow[],
  managers: Array<{ hotelId: string; departmentId: string | null; id: string; fullName: string }>,
  now: Date,
): PendingApprovalWeek[] {
  const groups = new Map<string, { head: PendingTimesheetRow; rows: PendingTimesheetRow[] }>()

  for (const row of rows) {
    const key = `${row.hotelId}|${isoDay(row.weekStart)}`
    const group = groups.get(key) ?? { head: row, rows: [] }
    group.rows.push(row)
    groups.set(key, group)
  }

  return [...groups.values()]
    .map(({ head, rows: groupRows }) => {
      const byDepartment = new Map<string | null, PendingTimesheetRow[]>()

      for (const row of groupRows) {
        const list = byDepartment.get(row.departmentId) ?? []
        list.push(row)
        byDepartment.set(row.departmentId, list)
      }

      return {
        hotelId: head.hotelId,
        hotelName: head.hotelName,
        weekStart: isoDay(head.weekStart),
        weekEnd: isoDay(head.weekEnd),
        cutoff: head.cutoff.toISOString(),
        daysLate: daysSince(head.cutoff, now),
        pendingTimesheets: groupRows.length,
        responsables: [...byDepartment.entries()].map(([departmentId, deptRows]) => ({
          departmentName: deptRows[0]?.departmentName ?? null,
          managers: managers
            .filter((m) => m.hotelId === head.hotelId && m.departmentId === departmentId)
            .map((m) => ({ id: m.id, fullName: m.fullName })),
        })),
      }
    })
    .sort(
      (a, b) => b.weekStart.localeCompare(a.weekStart) || a.hotelName.localeCompare(b.hotelName),
    )
}
