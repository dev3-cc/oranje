import { describe, expect, it } from 'vitest'

import { addDaysIso, todayIso } from '../lib/weekNavigation'
import { EMPTY_TIMESHEET_FILTERS } from '../types/timesheet.types'

import { enElPeriodo, periodoPorDefecto } from './timesheetApi'

/**
 * La regla que decide qué semanas entran en un periodo (Hugo, 2026-10-05).
 *
 * Lo que importa aquí es el criterio: una semana entra si **toca** el
 * periodo, no si cabe entera. Quien pide «del 1 al 20» espera ver la semana
 * que empieza el 29 y termina el 4 — si se exigiera que cupiera completa,
 * perdería los días del 1 al 4 sin que nada se lo dijera.
 */
/** Lunes de cuatro semanas seguidas. */
const SEMANAS = ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19']

/** Lo mínimo que la función mira: el lunes de la semana. */
const comoTimesheets = (semanas: string[]): never[] =>
  semanas.map((weekStart) => ({ weekStart })) as never[]

/** Se prueba la función REAL del API, no una copia que puede desviarse. */
function semanasEn(semanas: string[], from: string, to: string): string[] {
  return enElPeriodo(comoTimesheets(semanas), { ...EMPTY_TIMESHEET_FILTERS, from, to }).map(
    (sheet) => sheet.weekStart,
  )
}

describe('el periodo del Timesheet', () => {
  it('sin periodo no acota nada', () => {
    expect(semanasEn(SEMANAS, '', '')).toEqual(SEMANAS)
  })

  it('incluye la semana que ARRANCA antes del periodo pero lo toca', () => {
    /* La del 28 de septiembre termina el 4 de octubre: tiene días dentro. */
    expect(semanasEn(SEMANAS, '2026-10-01', '2026-10-20')).toContain('2026-09-28')
  })

  it('deja fuera la que termina antes de empezar el periodo', () => {
    expect(semanasEn(SEMANAS, '2026-10-05', '2026-10-20')).not.toContain('2026-09-28')
  })

  it('deja fuera la que empieza después de terminar el periodo', () => {
    expect(semanasEn(SEMANAS, '2026-09-28', '2026-10-11')).toEqual(['2026-09-28', '2026-10-05'])
  })

  it('un solo extremo ya acota: «desde el 12» es una pregunta legítima', () => {
    expect(semanasEn(SEMANAS, '2026-10-12', '')).toEqual(['2026-10-12', '2026-10-19'])
    expect(semanasEn(SEMANAS, '', '2026-10-05')).toEqual(['2026-09-28', '2026-10-05'])
  })

  it('un periodo sin ninguna semana devuelve vacío, no todo', () => {
    /* El caso que deja la pantalla en blanco si nadie lo explica. */
    expect(semanasEn(SEMANAS, '2026-12-01', '2026-12-31')).toEqual([])
  })
})

/**
 * Sin periodo a mano, `paramsDe` igual manda uno: pedir sin acotar dejaba que
 * el tope del listado mordiera en silencio (2026-10-22, reproducido en vivo
 * con ponches reales que la Contadora veía como "sin marcas").
 */
describe('el periodo por defecto, sin filtro a mano', () => {
  it('sin periodo ni semana elegida, la ventana es alrededor de hoy', () => {
    const hoy = todayIso()
    expect(periodoPorDefecto({ ...EMPTY_TIMESHEET_FILTERS, from: '', to: '' })).toEqual({
      from: addDaysIso(hoy, -70),
      to: addDaysIso(hoy, 7),
    })
  })

  it('con una semana elegida, la ventana se recentra ahí, no en hoy', () => {
    const semana = '2026-08-03'
    expect(
      periodoPorDefecto({ ...EMPTY_TIMESHEET_FILTERS, from: '', to: '', weekStart: semana }),
    ).toEqual({ from: addDaysIso(semana, -70), to: addDaysIso(semana, 7) })
  })

  it('un periodo puesto a mano, aunque sea un solo extremo, no se toca', () => {
    expect(periodoPorDefecto({ ...EMPTY_TIMESHEET_FILTERS, from: '2026-01-01', to: '' })).toEqual({
      from: '2026-01-01',
      to: '',
    })
    expect(periodoPorDefecto({ ...EMPTY_TIMESHEET_FILTERS, from: '', to: '2026-01-31' })).toEqual({
      from: '',
      to: '2026-01-31',
    })
  })
})
