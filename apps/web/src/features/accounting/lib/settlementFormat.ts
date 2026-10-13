import { formatMoney } from '@/shared/lib/formatters'

const MS_PER_DAY = 86_400_000

/**
 * El lunes (`AAAA-MM-DD`) de la semana que contiene `iso`. Lo que llega del
 * selector de fecha se convierte aquí: el API compara `week_start` contra un
 * lunes exacto, así que cualquier otro día no encontraría nada.
 */
export function mondayOf(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`)
  const weekday = (date.getUTCDay() + 6) % 7
  return new Date(date.getTime() - weekday * MS_PER_DAY).toISOString().slice(0, 10)
}

/**
 * El miércoles de corte de pago de la semana que empieza en `weekStart`
 * (lunes): `weekEnd + 3` — el mismo cómputo de `weekCalendar()` en
 * `payment-calendar.ts` del API, pero solo el DÍA, no el instante exacto
 * (el corte es una hora de pared en la zona del hotel; la fecha del día no
 * cambia por eso, ningún hotel tiene un desfase que cruce medianoche a esa
 * hora). Es lo que Contabilidad ve antes de que corra el corte real.
 */
export function closingDateOf(weekStart: string): string {
  return new Date(Date.parse(`${weekStart}T00:00:00Z`) + 9 * MS_PER_DAY).toISOString().slice(0, 10)
}

/** Los montos del API llegan como cadena decimal; se formatean sin pasar por `number` en el cálculo. */
export function money(amount: string): string {
  return formatMoney(Number(amount))
}

/** `2400` minutos → `40.00 h`. Las horas son dato de conteo, no de dinero. */
export function hoursOf(minutes: number): string {
  return `${(minutes / 60).toFixed(2)} h`
}
