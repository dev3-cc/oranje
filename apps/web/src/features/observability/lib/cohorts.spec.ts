import { describe, expect, it } from 'vitest'

import {
  addWeeks,
  buildPresence,
  cohortDetail,
  mondayOf,
  retentionAt,
  retentionTable,
} from './cohorts'

import type { TimesheetApi, WorkerApi } from '@/shared/types/apiContract.types'

const CURRENT = '2026-10-05' // lunes

function sheet(workerId: string, weekStart: string, requisitionId = 'r1'): TimesheetApi {
  return {
    id: `${workerId}-${weekStart}-${requisitionId}`,
    worker: { id: workerId, fullName: workerId.toUpperCase() },
    requisitionId,
    weekStart,
    weekEnd: weekStart,
    status: 'OPEN',
    approvedAt: null,
  }
}

const hotels = new Map([['r1', 'Hotel Uno']])

describe('semanas', () => {
  it('agrupa por el lunes aunque la semana del contrato empiece otro día', () => {
    expect(mondayOf('2026-10-07')).toBe('2026-10-05')
    expect(mondayOf('2026-10-05')).toBe('2026-10-05')
    expect(mondayOf('2026-10-11')).toBe('2026-10-05')
    expect(addWeeks('2026-10-05', -1)).toBe('2026-09-28')
  })
})

describe('cohorte de ingreso', () => {
  const lastWeek = addWeeks(CURRENT, -1) // 28 sep
  const presence = buildPresence(
    [
      // a: ingresó la semana pasada y sigue esta semana.
      sheet('a', lastWeek),
      sheet('a', CURRENT),
      // b: ingresó la semana pasada (su timesheet empieza en miércoles) y no regresó.
      sheet('b', '2026-09-30'),
      // c: trabajaba desde antes: no es ingreso de la semana pasada.
      sheet('c', addWeeks(CURRENT, -3)),
      sheet('c', lastWeek),
    ],
    hotels,
  )
  const workers = new Map([
    ['a', { id: 'a', state: { code: 'APPLE_GREEN' } }],
    ['b', { id: 'b', state: { code: 'PINK' } }],
  ]) as unknown as Map<string, WorkerApi>

  it('cuenta solo a quien trabajó por primera vez esa semana', () => {
    const detail = cohortDetail(presence, lastWeek, CURRENT, workers)
    expect(detail.members.map((member) => member.workerId)).toEqual(['a', 'b'])
    expect(detail.returnedNextWeek).toBe(1)
    expect(detail.members[0]?.hotels).toEqual(['Hotel Uno'])
  })

  it('a quien ya no trabaja lo explica su estado actual', () => {
    const detail = cohortDetail(presence, lastWeek, CURRENT, workers)
    expect(detail.members.find((member) => member.workerId === 'a')?.outcome).toBe('ACTIVE')
    // b solo ponchó en su semana de ingreso: ya no cuenta como activo, y su
    // estado (Stand-by) dice por qué.
    expect(detail.active).toBe(1)
    expect(detail.members.find((member) => member.workerId === 'b')?.outcome).toBe('STAND_BY')
    const older = cohortDetail(presence, addWeeks(CURRENT, -3), CURRENT, workers)
    expect(older.members[0]?.outcome).toBe('ACTIVE')
  })

  it('la semana siguiente que no ha empezado da null', () => {
    expect(cohortDetail(presence, CURRENT, CURRENT, workers).returnedNextWeek).toBeNull()
  })
})

describe('retención', () => {
  const start = addWeeks(CURRENT, -4)
  const presence = buildPresence(
    [
      sheet('a', start),
      sheet('a', addWeeks(start, 1)),
      sheet('a', addWeeks(start, 4)),
      sheet('b', start),
      sheet('c', addWeeks(start, 1)),
    ],
    hotels,
  )

  it('tabla semanal por cohorte, con la columna en curso marcada', () => {
    const table = retentionTable(presence, 'week', CURRENT, 6)
    const row = table.find((item) => item.cohort === start)
    expect(row?.size).toBe(2)
    expect(row?.cells.map((cell) => cell.share)).toEqual([1, 0.5, 0, 0, 0.5])
    expect(row?.cells[4]?.partial).toBe(true)
  })

  it('a 1 semana solo cuenta cohortes cuya semana siguiente ya terminó', () => {
    expect(retentionAt(presence, 1, CURRENT, 12)).toEqual({ part: 1, whole: 3 })
  })

  it('mensual agrupa por el mes del primer lunes', () => {
    const table = retentionTable(presence, 'month', CURRENT, 3)
    expect(table[0]?.cohort).toBe('2026-09')
    expect(table[0]?.size).toBe(3)
  })
})
