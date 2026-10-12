import { describe, expect, it } from 'vitest'

import { pushRouteFor } from './nativePush'

const WORKER = 'ROL-C-01'
const MANAGER = 'ROL-H-03'

describe('a dónde lleva un aviso push', () => {
  it('el Colaborador siempre va a sus avisos', () => {
    expect(pushRouteFor(WORKER, { entityType: 'demand.requisition', entityId: 'r1' })).toBe(
      '/collaborator/notifications',
    )
  })

  it('el hotel abre la requisición del aviso', () => {
    expect(pushRouteFor(MANAGER, { entityType: 'demand.requisition', entityId: 'r1' })).toBe(
      '/requisitions/r1',
    )
  })

  it('el hotel va al Timesheet o a Mi personal según el aviso', () => {
    expect(pushRouteFor(MANAGER, { entityType: 'operations.punch_mark', entityId: 'p1' })).toBe(
      '/timesheet',
    )
    expect(pushRouteFor(MANAGER, { entityType: 'personal.worker', entityId: 'w1' })).toBe(
      '/my-staff',
    )
  })

  it('sin un destino conocido, a su Inicio', () => {
    expect(pushRouteFor(MANAGER, { entityType: 'commercial.contract' })).toBe('/dashboard')
    expect(pushRouteFor(MANAGER, {})).toBe('/dashboard')
  })
})
