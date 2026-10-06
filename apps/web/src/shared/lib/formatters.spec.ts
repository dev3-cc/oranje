import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { formatDate, formatDateTime, formatDayMonthTime, formatTimeIn, todayIn } from './formatters'

/**
 * Las horas que no eran (Hugo, 2026-09-29).
 *
 * Hasta hoy `formatDateTime` y `formatDayMonthTime` sacaban la hora del TEXTO
 * del ISO con una expresión regular. Como el API manda instantes en UTC, todo
 * el mundo veía la hora de Greenwich: un ponche de las 18:00 en Georgia se
 * leía «22:00».
 *
 * Las pruebas fijan zona a mano en vez de depender de la del equipo que las
 * corra — si no, pasarían en Londres y fallarían aquí.
 */
describe('la hora se convierte, no se corta del texto', () => {
  const instante = '2026-09-14T22:00:00.000Z'

  it('un instante en UTC se lee en la zona que se pida', () => {
    // 22:00Z son las 18:00 en Nueva York (verano); el formato de 12 o 24 h lo
    // pone el idioma, así que la aserción mira la HORA, no cómo se escribe.
    expect(formatTimeIn(instante, 'America/New_York')).toMatch(/\b0?6:00\b|\b18:00\b/)
    expect(formatTimeIn(instante, 'UTC')).toMatch(/\b10:00\b|\b22:00\b/)
  })

  it('la fecha con hora usa la zona pedida, y el DÍA va con ella', () => {
    /* 22:00 del 14 en Georgia es el 15 a las 02:00 en UTC: si la hora se
       convierte y el día no, la línea mezcla dos días. */
    const enHotel = formatDayMonthTime('2026-09-15T02:00:00.000Z', 'America/New_York')

    expect(enHotel).toMatch(/14/)
    expect(enHotel).not.toMatch(/15/)
  })

  it('una fecha sin hora sigue siendo un día, sin inventar una', () => {
    expect(formatDayMonthTime('2026-09-14')).toBe(formatDate('2026-09-14').replace(' 2026', ''))
    expect(formatDateTime('2026-09-14')).toBe(formatDate('2026-09-14'))
  })

  it('sin zona cae en la del navegador, que es lo correcto para un hecho del sistema', () => {
    /* «Autorizada hace un momento» tiene que cuadrar con el reloj de quien
       mira; los hechos DE UN HOTEL son el otro caso y llevan su zona. */
    const local = new Date(instante).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })

    expect(formatDateTime(instante)).toContain(local.replace(/\s?[ap]\.?\s?m\.?/i, '').trim())
  })
})

describe('todayIn', () => {
  // 02:00 UTC del 2 de octubre son las 22:00 del 1 en Nueva York: si HOY se
  // calcula en UTC a secas, un turno que sigue abierto pasada la medianoche
  // de Greenwich se lee como "de ayer" aunque siga siendo hoy en el hotel.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-02T02:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('hoy se calcula en la zona del hotel, no en UTC', () => {
    expect(todayIn('America/New_York')).toBe('2026-10-01')
    expect(todayIn('UTC')).toBe('2026-10-02')
  })
})
