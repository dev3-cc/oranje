/**
 * El calendario de pago de una semana cerrada, en la hora del hotel.
 *
 *   Lun ── Dom (la semana) │ Mié: plazo de aprobación, corte de pago
 *                          │ Jue: envío de emergencia │ Sáb: correo de horas
 *
 * Los días son fijos por el ciclo de Oranje; las horas son límites del
 * Administrador (`PaymentLimits`), no constantes. Todo se calcula desde el
 * lunes de la semana y la zona del hotel: el mismo lunes en dos zonas da dos
 * conjuntos de instantes distintos.
 */

export interface PaymentLimits {
  /** Miércoles. Hasta aquí el Manager de Área debe aprobar las horas. */
  approvalDeadline: string
  /** Miércoles. Lo aprobado hasta aquí se paga ese día. */
  paymentCut: string
  /** Jueves. Paga lo que se aprobó después del corte del miércoles. */
  emergencySend: string
  /** Sábado. Correo de estado de horas al Supervisor y al Manager de Área. */
  saturdayNotice: string
}

export const DEFAULT_PAYMENT_LIMITS: PaymentLimits = {
  approvalDeadline: '11:00',
  paymentCut: '16:00',
  emergencySend: '11:00',
  saturdayNotice: '09:00',
}

export const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/
export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

export interface WeekCalendar {
  weekStart: string
  weekEnd: string
  approvalDeadline: Date
  paymentCut: Date
  emergencySend: Date
  saturdayNotice: Date
}

/** Suma días a una fecha `AAAA-MM-DD` sin tocar la zona: todo en UTC. */
export function addDays(day: string, days: number): string {
  const ms = Date.parse(`${day}T00:00:00Z`) + days * 86_400_000

  return new Date(ms).toISOString().slice(0, 10)
}

/** Fecha `AAAA-MM-DD` de un instante, vista desde la zona indicada. */
export function localDay(instant: Date, timeZone: string): string {
  const parts = partsOf(instant, timeZone)

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

/**
 * El instante en que en `timeZone` son las `hhmm` del día `day`.
 *
 * Usa Intl para leer el desfase de la zona en ese instante y lo corrige una
 * vez más: el desfase cambia con el horario de verano, y la segunda pasada
 * lo ve ya del lado correcto cuando el salto cae cerca.
 */
export function zonedInstant(day: string, hhmm: string, timeZone: string): Date {
  const [year, month, dayOfMonth] = day.split('-').map(Number) as [number, number, number]
  const [hour, minute] = hhmm.split(':').map(Number) as [number, number]
  const wallAsUtc = Date.UTC(year, month - 1, dayOfMonth, hour, minute)

  const first = wallAsUtc - offsetMs(wallAsUtc, timeZone)
  const second = wallAsUtc - offsetMs(first, timeZone)

  return new Date(second)
}

/** Calendario de una semana: `weekStart` es el lunes, como en `operations.timesheet`. */
export function weekCalendar(
  weekStart: string,
  timeZone: string,
  limits: PaymentLimits = DEFAULT_PAYMENT_LIMITS,
): WeekCalendar {
  const weekEnd = addDays(weekStart, 6)

  return {
    weekStart,
    weekEnd,
    approvalDeadline: zonedInstant(addDays(weekEnd, 3), limits.approvalDeadline, timeZone),
    paymentCut: zonedInstant(addDays(weekEnd, 3), limits.paymentCut, timeZone),
    emergencySend: zonedInstant(addDays(weekEnd, 4), limits.emergencySend, timeZone),
    saturdayNotice: zonedInstant(addDays(weekEnd, 6), limits.saturdayNotice, timeZone),
  }
}

/**
 * La semana cerrada para el correo del sábado: el último sábado que ya llegó
 * en la zona del hotel, menos seis días (el domingo que cerró la semana). Un
 * sábado a mediodía toma su propio sábado; un viernes de madrugada en Nueva
 * York toma el sábado anterior, porque el de esta semana todavía no llega.
 */
export function closedWeekForSaturday(now: Date, timeZone: string): string {
  const today = localDay(now, timeZone)
  const dayOfWeek = new Date(`${today}T00:00:00Z`).getUTCDay()
  const lastSaturday = addDays(today, -((dayOfWeek + 1) % 7))

  return addDays(lastSaturday, -12)
}

function offsetMs(instant: number, timeZone: string): number {
  const floored = Math.floor(instant / 1000) * 1000
  const parts = partsOf(new Date(floored), timeZone)
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )

  return asUtc - floored
}

interface Parts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function partsOf(instant: Date, timeZone: string): Parts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(formatter.formatToParts(instant).find((p) => p.type === type)?.value)

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  }
}

const pad = (n: number): string => String(n).padStart(2, '0')
