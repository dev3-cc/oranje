import { describe, expect, it } from 'vitest'

import { noShiftMessageOf } from './noShiftMessage'

describe('noShiftMessageOf', () => {
  it('con asignación (Naranja, Café, Verde manzana, Azul claro) hoy se descansa', () => {
    for (const code of ['ORANGE', 'BROWN', 'APPLE_GREEN', 'LIGHT_BLUE']) {
      expect(noShiftMessageOf(code).title).toBe('Hoy descansas')
    }
  })

  it('sin asignación (Verde fuerte, Amarillo) se dice que aún no lo asignan', () => {
    for (const code of ['STRONG_GREEN', 'YELLOW']) {
      expect(noShiftMessageOf(code).title).toBe('Aún no tienes asignación')
    }
  })

  it('Blanco espera la validación de la Reclutadora', () => {
    expect(noShiftMessageOf('WHITE').title).toBe('Aún no te validan')
  })

  it('Rosa y Gris explican el descanso o la incapacidad', () => {
    expect(noShiftMessageOf('PINK').title).toBe('Estás en Stand-by')
    expect(noShiftMessageOf('GRAY').title).toBe('Estás en incapacidad')
  })

  it('sin estado conocido cae al mensaje genérico', () => {
    expect(noShiftMessageOf(undefined).title).toBe('Hoy no tienes turno')
    expect(noShiftMessageOf('ALGO_NUEVO').title).toBe('Hoy no tienes turno')
  })
})
