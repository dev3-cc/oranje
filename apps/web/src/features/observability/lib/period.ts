import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

/**
 * El periodo que mide cada KPI «del periodo». Por defecto la semana en curso
 * (Hugo, 2026-10-07). La semana empieza el lunes 00:00 en la hora del
 * navegador: el Observador ve todos los hoteles a la vez y no hay una sola
 * zona que mande.
 */
export const PERIODS = ['week', 'month', 'quarter'] as const

export type PeriodKey = (typeof PERIODS)[number]

export const PERIOD_LABEL: Record<PeriodKey, MessageDescriptor> = {
  week: msg`Esta semana`,
  month: msg`Este mes`,
  quarter: msg`Últimos 90 días`,
}

export interface Period {
  key: PeriodKey
  /** Inicio, incluido. */
  from: Date
  /** Ahora: el periodo siempre termina en el presente. */
  to: Date
}

const MS_PER_DAY = 86_400_000

export function periodOf(key: PeriodKey, now: Date = new Date()): Period {
  const from = new Date(now)
  from.setHours(0, 0, 0, 0)
  if (key === 'week') {
    // getDay(): domingo = 0. El lunes es el primer día.
    const sinceMonday = (from.getDay() + 6) % 7
    from.setDate(from.getDate() - sinceMonday)
  } else if (key === 'month') {
    from.setDate(1)
  } else {
    from.setDate(from.getDate() - 89)
  }
  return { key, from, to: now }
}

export function isInPeriod(iso: string | null | undefined, period: Period): boolean {
  if (!iso) return false
  const time = new Date(iso).getTime()
  return time >= period.from.getTime() && time <= period.to.getTime()
}

/** `AAAA-MM-DD` de una fecha en la hora del navegador. */
export function dayIso(date: Date): string {
  return date.toLocaleDateString('en-CA')
}

export function hoursBetween(fromIso: string, toIso: string): number {
  return (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 3_600_000
}

/** Días completos entre dos `AAAA-MM-DD` (o ISO con hora: cuenta el día). */
export function daysBetween(fromDay: string, toDay: string): number {
  const from = Date.parse(`${fromDay.slice(0, 10)}T00:00:00Z`)
  const to = Date.parse(`${toDay.slice(0, 10)}T00:00:00Z`)
  return Math.round((to - from) / MS_PER_DAY)
}

export function daysAgo(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * MS_PER_DAY)
}

/** `AAAA-MM-DD` de un instante en la zona dada (la del hotel, si se sabe). */
export function localDay(iso: string, timeZone?: string | null): string {
  return new Date(iso).toLocaleDateString('en-CA', timeZone ? { timeZone } : {})
}
