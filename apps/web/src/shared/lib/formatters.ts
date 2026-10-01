import { t } from '@lingui/core/macro'

import { currentLocale, localeTag, type Locale } from '@/app/i18n'

/**
 * Formato de fechas y montos para la UI.
 *
 * Escrito a mano en vez de `Intl.DateTimeFormat`: la abreviatura de mes varía
 * entre versiones de ICU («jun» vs «jun.»), y el diseño fija «12 may 2026».
 * Con una tabla el resultado es el mismo en cualquier navegador y en Node.
 * Una tabla POR IDIOMA (D-36): en inglés el orden también cambia,
 * «May 12, 2026».
 */

const MONTHS_SHORT: Record<Locale, readonly string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

const WEEKDAYS_SHORT: Record<Locale, readonly string[]> = {
  es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}

/** Domingo es 0, como `week_start_day` en la base. */
const WEEKDAYS_LONG: Record<Locale, readonly string[]> = {
  es: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}

/**
 * El nombre completo del día por su número (domingo = 0), en el idioma activo.
 *
 * Lo pide la semana de nómina del contrato, que guarda el día como número y lo
 * enseña con nombre. Vivía como un arreglo fijo en español y era el único texto
 * del módulo que no cambiaba de idioma.
 */
export function weekdayName(index: number): string {
  return WEEKDAYS_LONG[currentLocale()][index] ?? ''
}

function monthShort(month: number): string {
  return MONTHS_SHORT[currentLocale()][month - 1] ?? ''
}

/** `12 may 2026` en español, `May 12, 2026` en inglés. */
function dayMonthYear(day: number, month: number, year: number): string {
  return currentLocale() === 'en'
    ? `${monthShort(month)} ${day}, ${year}`
    : `${day} ${monthShort(month)} ${year}`
}

/** `12 may` en español, `May 12` en inglés. */
function dayMonth(day: string | number, month: number): string {
  return currentLocale() === 'en' ? `${monthShort(month)} ${day}` : `${day} ${monthShort(month)}`
}

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
  return dayMonthYear(parts.day, parts.month, parts.year)
}

/** `2026-05-12` -> `12 may`. Para listas donde el año se repite en cada fila. */
export function formatDayMonth(iso: string): string {
  const parts = parseIsoDate(iso)
  if (!parts) return iso
  return dayMonth(String(parts.day).padStart(2, '0'), parts.month)
}

/** `185` -> `$185.00`. Las tarifas se muestran siempre con dos decimales. */
export function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`
}

/** `4` -> `4 d en estado`. */
export function formatDaysInStatus(days: number): string {
  return t`${days} d en estado`
}

/**
 * `2026-08-12T09:41:00Z` -> `12 ago 03:41` en México.
 *
 * La hora se CONVIERTE a la zona de quien mira, no se corta del texto: hasta
 * el 2026-09-29 esto leía los dos dígitos del ISO con una expresión regular,
 * así que un instante en UTC —como los devuelve el API— se pintaba con la
 * hora de Greenwich a todo el mundo (Hugo: «mostraba horas que no eran»).
 *
 * Aquí la zona correcta es la de la PERSONA: «autorizada hace un momento»
 * tiene que cuadrar con su reloj de pared. Los hechos que ocurren DENTRO de
 * un hotel —turnos y ponches— son el otro caso y van con `formatTimeIn` y la
 * zona del hotel.
 *
 * Una fecha sin hora (`2026-08-12`) se devuelve como día, sin inventar una.
 */
export function formatDayMonthTime(iso: string, timeZone?: string): string {
  if (!/T\d{2}:\d{2}/.test(iso)) return formatDayMonth(iso)

  return `${formatDayMonth(localDayIso(iso, timeZone))} ${formatTimeIn(iso, timeZone)}`
}

/**
 * `2026-08-12T09:30:00Z` -> `12 ago 2026 03:30` en México. Ver
 * `formatDayMonthTime`: la hora se convierte, no se corta.
 */
export function formatDateTime(iso: string, timeZone?: string): string {
  if (!/T\d{2}:\d{2}/.test(iso)) return formatDate(iso)

  return `${formatDate(localDayIso(iso, timeZone))} ${formatTimeIn(iso, timeZone)}`
}

/**
 * El DÍA de un instante en la zona que se pida, como `AAAA-MM-DD`.
 *
 * Hace falta porque la conversión puede cambiar de día: un ponche de las
 * 20:00 en Georgia es el día siguiente en UTC, y mostrar «13 ago 20:00»
 * cuando el ISO dice 13 a las 00:00Z sería mezclar dos días en una línea.
 */
function localDayIso(iso: string, timeZone?: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  /* `en-CA` da AAAA-MM-DD, que es justo la forma que leen los formatos de
     fecha de arriba; el idioma visible lo pone cada uno de ellos. */
  return date.toLocaleDateString('en-CA', {
    ...(timeZone ? { timeZone } : {}),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

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
  return WEEKDAYS_SHORT[currentLocale()][index] ?? iso
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

  const toLabel = dayMonthYear(to.day, to.month, to.year)
  if (from.month === to.month && from.year === to.year) {
    return currentLocale() === 'en'
      ? `${monthShort(from.month)} ${from.day} – ${to.day}, ${to.year}`
      : `${from.day} – ${toLabel}`
  }

  return `${dayMonth(from.day, from.month)} – ${toLabel}`
}

/** `7.1` -> `7.1h`; `8` -> `8h`. Las horas no arrastran decimales de más. */
/**
 * Hora de un instante en la zona que se pida (IANA). Sin zona, la del
 * navegador. Un turno se lee SIEMPRE en la zona del hotel: 07:00 en Cancún es
 * 07:00 aunque la persona mire el teléfono desde otra ciudad.
 */
export function formatTimeIn(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString(localeTag(), {
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  })
}

/**
 * `HH:MM` de 24 horas en la zona que se pida. **Es un dato, no una etiqueta.**
 *
 * El grid del Schedule usa estas cadenas para COLOCAR cada bloque en su
 * carril, así que no pueden venir en el formato del idioma: `07:00 a. m.` no
 * se puede restar. Para lo que la persona lee está `formatTimeIn`, que sí
 * respeta el idioma.
 */
export function clock24In(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
  })
}

/**
 * `2026-10-01` de HOY en la zona que se pida. Sin zona, la del navegador.
 *
 * Sirve para comparar contra `work_date` (un día del hotel, sin hora): un
 * turno que empezó y todavía no termina no es lo mismo que uno que terminó
 * sin que alguien marcara salida, y la frontera entre los dos es el día de
 * HOY en la zona donde ocurre el turno — no en la del navegador de quien
 * revisa (Hugo, 2026-10-01).
 */
export function todayIn(timeZone?: string): string {
  return new Date().toLocaleDateString('en-CA', {
    ...(timeZone ? { timeZone } : {}),
  })
}

export function formatHours(hours: number): string {
  return `${String(Math.round(hours * 10) / 10)}h`
}

/** `79` -> `3.3 días`; `18` -> `18h`. Bajo 48h en horas, arriba en días — nadie piensa "127 horas". */
export function formatDurationHuman(hours: number): string {
  if (hours < 48) return formatHours(hours)
  const days = Math.round((hours / 24) * 10) / 10
  return t`${days} días`
}

/** `0.21` -> `21%`. La API manda la fracción; el símbolo lo pone la UI. */
export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`
}

/** `['Norte','Centro','Sur']` -> `Norte, Centro y Sur`. */
export function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''

  return new Intl.ListFormat(localeTag(), { style: 'long', type: 'conjunction' }).format(items)
}
