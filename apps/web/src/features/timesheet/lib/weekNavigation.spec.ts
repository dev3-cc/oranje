import { describe, expect, it } from 'vitest'

import { blockRect, minutesOf, nowOffset } from './hoursGeometry'
import { addDaysIso, neighborWeek, resolveWeek, weekContaining } from './weekNavigation'

/** Los casos que muerden en fechas: cruces de mes y de año, y los bordes del lienzo. */

describe('addDaysIso', () => {
  it('cruza el mes', () => {
    expect(addDaysIso('2026-08-31', 6)).toBe('2026-09-06')
  })

  it('cruza el año', () => {
    expect(addDaysIso('2026-12-28', 6)).toBe('2027-01-03')
  })

  it('cruza febrero bisiesto', () => {
    expect(addDaysIso('2028-02-28', 6)).toBe('2028-03-05')
  })
})

describe('resolveWeek', () => {
  const weeks = ['2026-08-17', '2026-08-24', '2026-08-31']

  it('respeta la semana pedida cuando existe', () => {
    expect(resolveWeek(weeks, '2026-08-24')).toBe('2026-08-24')
  })

  it('cae a la más reciente cuando la pedida no existe (o es ALL)', () => {
    expect(resolveWeek(weeks, 'ALL')).toBe('2026-08-31')
  })

  it('sin semanas no hay nada que enseñar', () => {
    expect(resolveWeek([], 'ALL')).toBeNull()
  })
})

describe('neighborWeek', () => {
  const weeks = ['2026-08-17', '2026-08-24', '2026-08-31']

  it('camina en ambas direcciones', () => {
    expect(neighborWeek(weeks, '2026-08-24', -1)).toBe('2026-08-17')
    expect(neighborWeek(weeks, '2026-08-24', 1)).toBe('2026-08-31')
  })

  it('en los extremos no hay vecina', () => {
    expect(neighborWeek(weeks, '2026-08-17', -1)).toBeNull()
    expect(neighborWeek(weeks, '2026-08-31', 1)).toBeNull()
  })
})

describe('weekContaining', () => {
  const weeks = ['2026-08-17', '2026-08-24']

  it('encuentra la semana del día, incluidos sus bordes', () => {
    expect(weekContaining(weeks, '2026-08-26')).toBe('2026-08-24')
    expect(weekContaining(weeks, '2026-08-17')).toBe('2026-08-17')
    expect(weekContaining(weeks, '2026-08-23')).toBe('2026-08-17')
  })

  it('si hoy no tiene semana, «Hoy» lleva a la más reciente', () => {
    expect(weekContaining(weeks, '2026-09-15')).toBe('2026-08-24')
  })
})

describe('blockRect', () => {
  it('una jornada normal se dibuja completa', () => {
    // 07:00–15:00 sobre un lienzo que arranca a las 06:00 con 44 px/hora.
    expect(blockRect('07:00', '15:00')).toEqual({ top: 44, height: 352 })
  })

  it('lo que empieza antes del lienzo se recorta al borde', () => {
    expect(blockRect('05:00', '07:30')).toEqual({ top: 0, height: 66 })
  })

  it('una salida al día siguiente pinta hasta el fondo, no desborda', () => {
    const rect = blockRect('17:11', '03:40')
    expect(rect?.top).toBeCloseTo(((17 * 60 + 11 - 360) / 60) * 44, 3)
    expect(rect !== null && rect.top + rect.height).toBeCloseTo(16 * 44, 3)
  })

  it('una jornada completamente fuera del lienzo no se dibuja', () => {
    expect(blockRect('23:00', '23:30')).toBeNull()
  })

  it('una hora ilegible no se dibuja', () => {
    expect(minutesOf('—')).toBeNull()
    expect(blockRect('—', '15:00')).toBeNull()
  })
})

describe('nowOffset', () => {
  it('dentro del lienzo se posiciona por minutos', () => {
    expect(nowOffset(12 * 60 + 30)).toBeCloseTo(6.5 * 44, 3)
  })

  it('fuera del lienzo no hay línea', () => {
    expect(nowOffset(5 * 60)).toBeNull()
    expect(nowOffset(23 * 60)).toBeNull()
  })
})
