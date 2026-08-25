/**
 * Formato de fechas y montos para la UI.
 *
 * Escrito a mano en vez de `Intl.DateTimeFormat`: la abreviatura de mes varía
 * entre versiones de ICU («jun» vs «jun.»), y el diseño fija «12 may 2026».
 * Con una tabla el resultado es el mismo en cualquier navegador y en Node.
 */

const MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const

interface DateParts {
  day: number
  month: number
  year: number
}

/**
 * Parte una fecha ISO (`2026-05-12` o `2026-05-12T10:00:00Z`) sin construir un
 * `Date`. `new Date('2026-05-12')` se interpreta como medianoche UTC y en
 * México adelanta el día al anterior.
 */
function parseIsoDate(iso: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return null

  const [, year, month, day] = match
  return { year: Number(year), month: Number(month), day: Number(day) }
}

/** `2026-05-12` -> `12 may 2026`. */
export function formatDate(iso: string): string {
  const parts = parseIsoDate(iso)
  if (!parts) return iso
  return `${parts.day} ${MONTHS_SHORT[parts.month - 1]} ${parts.year}`
}

/** `2026-05-12` -> `12 may`. Para listas donde el año se repite en cada fila. */
export function formatDayMonth(iso: string): string {
  const parts = parseIsoDate(iso)
  if (!parts) return iso
  return `${String(parts.day).padStart(2, '0')} ${MONTHS_SHORT[parts.month - 1]}`
}

/** `185` -> `$185.00`. Las tarifas se muestran siempre con dos decimales. */
export function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`
}

/** `4` -> `4 d en estado`. */
export function formatDaysInStatus(days: number): string {
  return `${days} d en estado`
}

/** `2026-08-12T09:41:00` -> `12 ago 09:41`. */
export function formatDayMonthTime(iso: string): string {
  const time = /T(\d{2}:\d{2})/.exec(iso)
  return time ? `${formatDayMonth(iso)} ${time[1] ?? ''}` : formatDayMonth(iso)
}

/** `2026-08-12T09:30:00` -> `12 ago 2026 09:30`. */
export function formatDateTime(iso: string): string {
  const time = /T(\d{2}:\d{2})/.exec(iso)
  return time ? `${formatDate(iso)} ${time[1] ?? ''}` : formatDate(iso)
}

const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const

/**
 * `2026-07-31` -> `Vie`.
 *
 * Se lee el día en UTC a propósito: `new Date('2026-07-31')` es medianoche UTC
 * y en México `getDay()` devolvería el día anterior.
 */
export function formatWeekday(iso: string): string {
  const parts = parseIsoDate(iso)
  if (!parts) return iso

  const index = new Date(`${iso}T00:00:00Z`).getUTCDay()
  return WEEKDAYS_SHORT[index] ?? iso
}

/** `2026-07-31` -> `31`. El número grande de la columna. */
export function formatDayNumber(iso: string): string {
  return String(parseIsoDate(iso)?.day ?? iso)
}

/**
 * `2026-07-31`, `2026-08-06` -> `31 jul – 6 ago 2026`.
 *
 * Dentro del mismo mes se dice una sola vez: `11 – 17 ago 2026`. Repetirlo hace
 * más largo el título sin agregar nada.
 */
export function formatWeekRange(fromIso: string, toIso: string): string {
  const from = parseIsoDate(fromIso)
  const to = parseIsoDate(toIso)
  if (!from || !to) return `${fromIso} – ${toIso}`

  const toLabel = `${to.day} ${MONTHS_SHORT[to.month - 1]} ${to.year}`
  if (from.month === to.month && from.year === to.year) return `${from.day} – ${toLabel}`

  return `${from.day} ${MONTHS_SHORT[from.month - 1]} – ${toLabel}`
}

/** `7.1` -> `7.1h`; `8` -> `8h`. Las horas no arrastran decimales de más. */
export function formatHours(hours: number): string {
  return `${String(Math.round(hours * 10) / 10)}h`
}

/** `0.21` -> `21%`. La API manda la fracción; el símbolo lo pone la UI. */
export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`
}

/** `['Norte','Centro','Sur']` -> `Norte, Centro y Sur`. */
export function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''

  const last = items[items.length - 1] ?? ''
  return `${items.slice(0, -1).join(', ')} y ${last}`
}
