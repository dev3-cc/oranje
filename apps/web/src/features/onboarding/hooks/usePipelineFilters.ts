import { useCallback, useState } from 'react'

import type { PipelineFilters } from '../types/prospect.types'

/** Umbral del filtro «sin actividad», en días. */
const STALE_THRESHOLD_DAYS = 7

/**
 * Estado de los filtros del tablero.
 *
 * Por defecto: todas las zonas, sin dueño y sin filtro de antigüedad. El
 * dueño NO viaja a propósito: la API ya acota por permiso — un BD sin
 * `pipeline:read_all` solo ve lo suyo, y mandar `ownerUserId` es redundante
 * (y con el id de fixture de antes, un 400 directo: no era UUID).
 */
const DEFAULT_FILTERS: PipelineFilters = {
  zone: null,
  ownerId: null,
  staleDays: null,
}

export interface UsePipelineFiltersResult {
  filters: PipelineFilters
  isStaleOnly: boolean
  toggleStaleOnly: () => void
}

export function usePipelineFilters(): UsePipelineFiltersResult {
  const [filters, setFilters] = useState<PipelineFilters>(DEFAULT_FILTERS)

  const toggleStaleOnly = useCallback(() => {
    setFilters((current) => ({
      ...current,
      staleDays: current.staleDays === null ? STALE_THRESHOLD_DAYS : null,
    }))
  }, [])

  return { filters, isStaleOnly: filters.staleDays !== null, toggleStaleOnly }
}
