import { describe, expect, it } from 'vitest'

import { destinoTrasLogin } from './LoginPage'

/**
 * A dónde ir tras entrar. `lastRoute.ts` ya existe para no heredar la ruta de
 * otra persona (ver su propio comentario: "el bug que ya tuvimos con
 * `from`") — esto prueba que `from` queda SUBORDINADO a esa misma regla y no
 * puede saltársela, que es justo lo que no pasaba (reproducido en vivo
 * 2026-10-22: Contadora entraba después de que B. Díaz cerrara sesión y
 * caía en el Dashboard de Ventas de él, un 403).
 */
describe('a dónde ir tras entrar', () => {
  it('la MISMA persona que reanuda: `from` gana sobre su última ruta', () => {
    expect(destinoTrasLogin('/contracts/42', { userId: 'u1', path: '/proposals' }, 'u1')).toBe(
      '/contracts/42',
    )
  })

  it('la MISMA persona sin `from`: vuelve a su última ruta', () => {
    expect(destinoTrasLogin(undefined, { userId: 'u1', path: '/proposals' }, 'u1')).toBe(
      '/proposals',
    )
  })

  it('nadie antes en este navegador: la liga del QR/enlace se respeta', () => {
    expect(destinoTrasLogin('/collaborator/punch?qr=abc', null, 'u1')).toBe(
      '/collaborator/punch?qr=abc',
    )
  })

  it('nadie antes y sin `from`: a la raíz, que decide RoleHome', () => {
    expect(destinoTrasLogin(undefined, null, 'u1')).toBe('/')
  })

  it('OTRA persona entró antes: su `from` no se hereda, aunque exista', () => {
    /* `from` aquí es el resto del bote de la sesión anterior (RequireSession
       la mandó a `/login` al cerrar sesión desde esa ruta) — no una liga que
       pidió quien acaba de entrar. */
    expect(
      destinoTrasLogin('/dashboard', { userId: 'bd-1', path: '/dashboard' }, 'contadora-1'),
    ).toBe('/')
  })

  it('OTRA persona entró antes, sin `from`: tampoco se hereda su última ruta', () => {
    expect(destinoTrasLogin(undefined, { userId: 'bd-1', path: '/dashboard' }, 'contadora-1')).toBe(
      '/',
    )
  })
})
