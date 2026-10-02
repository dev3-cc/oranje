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

  it('una cuenta lleva al Dashboard, que redirige solo al Administrador a Usuarios', () => {
    /* Para el BDC con algo pendiente de aprobar, «Usuarios» ni aparece en su
       sidebar — el Dashboard sí es suyo, y es donde ahora vive la cola. */
    expect(notificationTarget({ type: 'identity.user', id: 'u-1' })).toBe('/dashboard')
  })

  it('sin entidad no hay destino: el aviso solo se marca leído', () => {
    expect(notificationTarget(null)).toBeNull()
  })

  it('una entidad que no conocemos no inventa ruta', () => {
    /* Mejor quedarse quieto que aterrizar en un 404. */
    expect(notificationTarget({ type: 'settlement.invoice', id: 'x' })).toBeNull()
  })
})
