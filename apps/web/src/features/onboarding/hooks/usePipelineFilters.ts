import { useCallback, useState } from 'react'

import type { PipelineFilters } from '../types/prospect.types'

/** Umbral del filtro «sin actividad», en días. */
const STALE_THRESHOLD_DAYS = 7

/**
 * Estado de los filtros del tablero.
 *
 * Por defecto: todas las zonas, sin dueño y sin filtro de antigüedad. El
 * dueño NO viaja por defecto a propósito: la API ya acota por permiso — un BD
 * sin `pipeline:read_all` solo ve lo suyo, y mandar `ownerUserId` es
 * redundante. Solo viaja cuando quien puede ver a otros (el BDC) elige
 * «Dueño: yo».
 */
const DEFAULT_FILTERS: PipelineFilters = {
  zone: null,
  ownerId: null,
  staleDays: null,
}

export interface UsePipelineFiltersResult {
  filters: PipelineFilters
  isStaleOnly: boolean
  /** Cuántos filtros están fuera de su valor «todos»: alimenta «Quitar filtros». */
  activeCount: number
  toggleStaleOnly: () => void
  /** `null` = todas las zonas. */
  setZone: (zoneId: string | null) => void
  /** `null` = todos los dueños. */
  setOwnerId: (ownerId: string | null) => void
  reset: () => void
}

export function usePipelineFilters(): UsePipelineFiltersResult {
  const [filters, setFilters] = useState<PipelineFilters>(DEFAULT_FILTERS)

  const toggleStaleOnly = useCallback(() => {
    setFilters((current) => ({
      ...current,
      staleDays: current.staleDays === null ? STALE_THRESHOLD_DAYS : null,
    }))
  }, [])

  const setZone = useCallback((zone: string | null) => {
    setFilters((current) => ({ ...current, zone }))
  }, [])

  const setOwnerId = useCallback((ownerId: string | null) => {
    setFilters((current) => ({ ...current, ownerId }))
  }, [])

  const reset = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
  }, [])

  const activeCount = [filters.zone, filters.ownerId, filters.staleDays].filter(
    (value) => value !== null,
  ).length

  return {
    filters,
    isStaleOnly: filters.staleDays !== null,
    activeCount,
    toggleStaleOnly,
    setZone,
    setOwnerId,
    reset,
  }
}
