import {
  DEFAULT_PAYMENT_LIMITS,
  addDays,
  closedWeekForSaturday,
  localDay,
  weekCalendar,
  zonedInstant,
} from '../src/modules/settlement/payment-calendar/payment-calendar.js'

/**
 * Fechas fijas y zonas distintas de UTC. Ninguna prueba depende de la hora a
 * la que se corra: el «ahora» siempre se pasa a mano.
 *
 * Calendario de referencia (verificado con el día de la semana):
 *   2026-10-04 es domingo  → su semana es 2026-09-28 a 2026-10-04.
 *   Miércoles 2026-10-07, jueves 2026-10-08, sábado 2026-10-10.
 */

describe('calendario de pago', () => {
  it('las fechas de referencia caen en el día que dicen', () => {
    expect(new Date('2026-10-04T00:00:00Z').getUTCDay()).toBe(0)
    expect(new Date('2026-10-07T00:00:00Z').getUTCDay()).toBe(3)
    expect(new Date('2026-10-10T00:00:00Z').getUTCDay()).toBe(6)
    expect(new Date('2026-11-01T00:00:00Z').getUTCDay()).toBe(0)
  })

  it('suma días sin tropezar con fin de mes ni de año', () => {
    expect(addDays('2026-10-28', 4)).toBe('2026-11-01')
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('Cancún (UTC-5, sin horario de verano): el corte de las 16:00 es las 21:00 UTC', () => {
    const cut = zonedInstant('2026-10-07', '16:00', 'America/Cancun')

    expect(cut.toISOString()).toBe('2026-10-07T21:00:00.000Z')
  })

  it('Ciudad de México (UTC-6 desde 2022): corte de las 16:00 son las 22:00 UTC', () => {
    const cut = zonedInstant('2026-10-07', '16:00', 'America/Mexico_City')

    expect(cut.toISOString()).toBe('2026-10-07T22:00:00.000Z')
  })

  it('Nueva York en octubre (EDT, UTC-4): el corte de las 16:00 es las 20:00 UTC', () => {
    const cut = zonedInstant('2026-10-07', '16:00', 'America/New_York')

    expect(cut.toISOString()).toBe('2026-10-07T20:00:00.000Z')
  })

  it('Nueva York con el cambio de horario en medio: el miércoles 4 de noviembre ya es EST (UTC-5)', () => {
    // El domingo 1 de noviembre de 2026 termina el horario de verano.
    const cal = weekCalendar('2026-10-26', 'America/New_York')

    expect(cal.weekEnd).toBe('2026-11-01')
    expect(cal.paymentCut.toISOString()).toBe('2026-11-04T21:00:00.000Z')
    expect(cal.emergencySend.toISOString()).toBe('2026-11-05T16:00:00.000Z')
  })

  it('la semana en Nueva York: plazo, corte, envío y sábado caen en las fechas y horas de la zona del hotel', () => {
    const cal = weekCalendar('2026-09-28', 'America/New_York')

    expect(cal.weekEnd).toBe('2026-10-04')
    expect(cal.approvalDeadline.toISOString()).toBe('2026-10-07T15:00:00.000Z') // 11:00 EDT
    expect(cal.paymentCut.toISOString()).toBe('2026-10-07T20:00:00.000Z') // 16:00 EDT
    expect(cal.emergencySend.toISOString()).toBe('2026-10-08T15:00:00.000Z') // jueves 11:00 EDT
    expect(cal.saturdayNotice.toISOString()).toBe('2026-10-10T13:00:00.000Z') // sábado 09:00 EDT
  })

  it('la misma semana en Cancún no es la misma hora que en Nueva York: la zona del hotel manda', () => {
    const nyc = weekCalendar('2026-09-28', 'America/New_York')
    const cancun = weekCalendar('2026-09-28', 'America/Cancun')

    expect(cancun.paymentCut.toISOString()).toBe('2026-10-07T21:00:00.000Z')
    expect(cancun.paymentCut.getTime()).not.toBe(nyc.paymentCut.getTime())
  })

  it('los límites configurados se respetan y cambian los instantes', () => {
    const cal = weekCalendar('2026-09-28', 'America/Cancun', {
      ...DEFAULT_PAYMENT_LIMITS,
      paymentCut: '18:30',
      saturdayNotice: '07:15',
    })

    expect(cal.paymentCut.toISOString()).toBe('2026-10-07T23:30:00.000Z')
    expect(cal.saturdayNotice.toISOString()).toBe('2026-10-10T12:15:00.000Z')
  })

  it('localDay lee la fecha de la zona, no la de UTC', () => {
    // Sábado 2026-10-10 a las 02:00 UTC es viernes 9 de octubre en Nueva York (22:00).
    const instant = new Date('2026-10-10T02:00:00.000Z')

    expect(localDay(instant, 'America/New_York')).toBe('2026-10-09')
    expect(localDay(instant, 'UTC')).toBe('2026-10-10')
  })

  it('el correo del sábado cubre la semana que cerró en la zona del hotel', () => {
    // Sábado 2026-10-10 a mediodía en Nueva York: cerró la semana del 28 de septiembre.
    const now = new Date('2026-10-10T16:00:00.000Z')

    expect(closedWeekForSaturday(now, 'America/New_York')).toBe('2026-09-28')
  })

  it('a la misma hora UTC, otra zona ya es otro día: el sábado de Nueva York es viernes en UTC', () => {
    // Sábado 2026-10-10 a las 02:00 UTC: en Nueva York todavía es viernes 9.
    // La semana que cerró para el hotel de Nueva York es la del 21 de septiembre.
    const now = new Date('2026-10-10T02:00:00.000Z')

    expect(closedWeekForSaturday(now, 'America/New_York')).toBe('2026-09-21')
    expect(closedWeekForSaturday(now, 'UTC')).toBe('2026-09-28')
  })
})
