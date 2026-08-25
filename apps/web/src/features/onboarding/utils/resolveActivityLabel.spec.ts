import { describe, expect, it } from 'vitest'

import type { ProspectSummary } from '../types/prospect.types'

import { resolveActivityLabel } from './resolveActivityLabel'

const BASE: ProspectSummary = {
  id: 'psp-test',
  hotelName: 'Hotel de prueba',
  photoUrl: null,
  zone: 'Zona Centro',
  status: 'GRAY',
  daysInStatus: 3,
  lastAttempt: null,
  latestProposalVersion: null,
  owner: { id: 'usr-test', name: 'Ana Ruiz', shortName: 'A. Ruiz' },
}

describe('resolveActivityLabel', () => {
  it('avisa cuando no hay ningún intento registrado', () => {
    expect(resolveActivityLabel(BASE)).toBe('Sin intentos')
  })

  it('muestra canal y resultado del último intento', () => {
    expect(
      resolveActivityLabel({
        ...BASE,
        status: 'YELLOW',
        lastAttempt: { channel: 'Llamada', outcome: 'Interesado' },
      }),
    ).toBe('Llamada · Interesado')
  })

  it('en VERDE la propuesta le gana al intento: es lo que define esa columna', () => {
    expect(
      resolveActivityLabel({
        ...BASE,
        status: 'GREEN',
        lastAttempt: { channel: 'Correo', outcome: 'Interesado' },
        latestProposalVersion: 2,
      }),
    ).toBe('Propuesta v2')
  })

  it('en VERDE sin propuesta cae al intento en vez de mentir', () => {
    expect(
      resolveActivityLabel({
        ...BASE,
        status: 'GREEN',
        lastAttempt: { channel: 'Correo', outcome: 'Interesado' },
      }),
    ).toBe('Correo · Interesado')
  })
})
