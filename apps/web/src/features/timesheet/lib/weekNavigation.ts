/**
 * Navegación entre semanas del Timesheet. El contrato no pagina por fecha:
 * `GET /timesheets` trae lo que el alcance permite y aquí se decide qué semana
 * se enseña — por eso los vecinos son las semanas QUE EXISTEN en los datos,
 * no aritmética libre de calendario.
 */

const MS_PER_DAY = 86_400_000

/** ISO del día `offset` días después de `iso`. Aritmética en UTC, como los `days`. */
export function addDaysIso(iso: string, offset: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + offset * MS_PER_DAY)
    .toISOString()
    .slice(0, 10)
}

/** Días entre dos ISO (`to - from`); negativo si `to` es anterior. */
export function diffDaysIso(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / MS_PER_DAY,
  )
}

/** Hoy en la zona del NAVEGADOR: `toISOString` diría el día de UTC por la noche. */
export function todayIso(): string {
  return new Intl.DateTimeFormat('sv-SE').format(new Date())
}

/** La semana a enseñar: la pedida si existe entre las disponibles; si no, la más reciente. */
export function resolveWeek(availableWeeks: string[], requested: string): string | null {
  if (availableWeeks.includes(requested)) return requested
  return availableWeeks[availableWeeks.length - 1] ?? null
}

/** La vecina en esa dirección (`availableWeeks` asciende); `null` = no hay más. */
export function neighborWeek(
  availableWeeks: string[],
  current: string,
  direction: -1 | 1,
): string | null {
  const index = availableWeeks.indexOf(current)
  if (index === -1) return null
  return availableWeeks[index + direction] ?? null
}

/** La semana que contiene a `today`; si ninguna lo contiene, la más reciente. */
export function weekContaining(availableWeeks: string[], today: string): string | null {
  const hit = availableWeeks.find((week) => week <= today && today <= addDaysIso(week, 6))
  return hit ?? availableWeeks[availableWeeks.length - 1] ?? null
}
