import { describe, expect, it } from 'vitest'

import { notificationTarget } from './notificationTarget'

describe('a dónde lleva un aviso', () => {
  it('el expediente del colaborador, con su id', () => {
    expect(notificationTarget({ type: 'personal.worker', id: 'w-1' })).toBe(
      '/collaborator-pool/w-1',
    )
  })

  it('un ponche lleva al Timesheet, que es donde se revisa', () => {
    expect(notificationTarget({ type: 'operations.punch_mark', id: 'p-1' })).toBe('/timesheet')
  })

  it('sin entidad no hay destino: el aviso solo se marca leído', () => {
    expect(notificationTarget(null)).toBeNull()
  })

  it('una entidad que no conocemos no inventa ruta', () => {
    /* Mejor quedarse quieto que aterrizar en un 404. */
    expect(notificationTarget({ type: 'settlement.invoice', id: 'x' })).toBeNull()
  })
})
