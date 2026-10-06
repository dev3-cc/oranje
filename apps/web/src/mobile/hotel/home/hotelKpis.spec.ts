import { describe, expect, it } from 'vitest'

import type { AppRequisitionRow } from '../requisitions/requisitionsAppApi'

import { computeHotelKpis } from './hotelKpis'

const NOW = new Date('2026-10-06T12:00:00Z').getTime()
const hoursAgo = (hours: number): string => new Date(NOW - hours * 3_600_000).toISOString()

function row(patch: Partial<AppRequisitionRow>): AppRequisitionRow {
  return {
    id: 'r',
    number: '1',
    department: 'Housekeeping',
    status: 'GREEN',
    filled: 0,
    total: 1,
    urgency: 'STRONG_GREEN',
    startDate: null,
    createdByName: null,
    createdAt: hoursAgo(100),
    authorizedAt: null,
    openByDepartment: [],
    ...patch,
  }
}

describe('computeHotelKpis', () => {
  it('sin requisiciones no inventa porcentajes ni promedios', () => {
    expect(computeHotelKpis([], NOW)).toEqual({
      open: 0,
      awaitingAuthorization: 0,
      urgent: 0,
      openSlots: 0,
      fillRate: null,
      avgHoursToAuthorize: null,
      demandByDepartment: [],
    })
  })

  it('cuenta abiertas, borradores, urgentes y lugares sin cubrir', () => {
    const kpis = computeHotelKpis(
      [
        row({ status: 'APPLE_GREEN', total: 4, urgency: 'RED' }),
        row({
          status: 'YELLOW',
          filled: 2,
          total: 5,
          urgency: 'RED',
          openByDepartment: [{ department: 'Mantenimiento', open: 3 }],
        }),
        row({
          status: 'GREEN',
          filled: 0,
          total: 1,
          openByDepartment: [{ department: 'Housekeeping', open: 1 }],
        }),
        /* Cubierta y eliminada no cuentan como abiertas. */
        row({ status: 'LIGHT_BLUE', filled: 6, total: 6, urgency: 'RED' }),
        row({ status: 'PURPLE', total: 9 }),
      ],
      NOW,
    )

    expect(kpis.open).toBe(2)
    expect(kpis.awaitingAuthorization).toBe(1)
    /* El borrador urgente y la abierta urgente; la cubierta, no. */
    expect(kpis.urgent).toBe(2)
    expect(kpis.openSlots).toBe(4)
    expect(kpis.fillRate).toBeCloseTo(2 / 6)
    expect(kpis.demandByDepartment).toEqual([
      { department: 'Mantenimiento', open: 3 },
      { department: 'Housekeeping', open: 1 },
    ])
  })

  it('promedia horas de creada a autorizada solo en los últimos 90 días', () => {
    const kpis = computeHotelKpis(
      [
        row({ createdAt: hoursAgo(30), authorizedAt: hoursAgo(20) }),
        row({ createdAt: hoursAgo(50), authorizedAt: hoursAgo(20) }),
        /* Autorizada hace más de 90 días: fuera de la ventana. */
        row({ createdAt: hoursAgo(3000), authorizedAt: hoursAgo(2500) }),
      ],
      NOW,
    )

    expect(kpis.avgHoursToAuthorize).toBeCloseTo(20)
  })
})
