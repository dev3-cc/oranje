import type { StateDuration, StatusLightSummary } from '../types/observability.types'

/** Horas promedio en un estado de un semáforo con historia; `null` si no hay. */
export function stateAvgHours(
  summary: StatusLightSummary | undefined,
  code: string,
): number | null {
  if (!summary?.hasHistory || !summary.states) return null
  const state = (summary.states as StateDuration[]).find((item) => item.code === code)
  return state?.avgHours ?? null
}
