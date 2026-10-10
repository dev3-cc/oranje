import { describe, expect, it } from 'vitest'

import { sampleCostPositions, sampleCostWeeks } from './costsSample'

const TODAY = new Date('2026-10-07T15:00:00Z') // miércoles

describe('datos de ejemplo de costos', () => {
  it('8 semanas de lunes a domingo, la actual marcada y sin aprobado', () => {
    const { weeks } = sampleCostWeeks(TODAY)
    expect(weeks).toHaveLength(8)
    const current = weeks.find((week) => week.isCurrent)
    expect(current).toMatchObject({
      weekStart: '2026-10-05',
      weekEnd: '2026-10-11',
      approvedCost: null,
    })
    expect(current?.gaps).toContain('UNAPPROVED_HOURS')
  })

  it('la posición sin tarifa deja la semana incompleta y su costo en null', () => {
    const { positions } = sampleCostPositions('2026-09-28', TODAY)
    const withoutRate = positions.find((position) => position.billRate === null)
    expect(withoutRate).toMatchObject({ cost: null, status: 'INCOMPLETE' })
    expect(withoutRate?.gaps).toContain('POSITION_WITHOUT_RATE')
    expect(withoutRate?.regularMinutes).toBeGreaterThan(0)
  })

  it('las semanas viejas salen completas y con montos en texto decimal', () => {
    const { weeks } = sampleCostWeeks(TODAY)
    const oldest = weeks[weeks.length - 1]
    expect(oldest?.status).toBe('COMPLETE')
    expect(oldest?.approvedCost).toMatch(/^\d+\.\d{2}$/)
  })
})
