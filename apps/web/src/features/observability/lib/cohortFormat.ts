import { addWeeks } from './cohorts'

import { formatPercent, formatWeekRange } from '@/shared/lib/formatters'

/** `lunes` → «28 sep – 4 oct» (el domingo es el lunes siguiente menos un día). */
export function weekRangeOf(monday: string): string {
  const sunday = new Date(Date.parse(`${addWeeks(monday, 1)}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10)
  return formatWeekRange(monday, sunday)
}

export function share(part: number, whole: number): string {
  return whole === 0 ? '—' : formatPercent(part / whole)
}
