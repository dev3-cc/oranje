import { useCallback, useState } from 'react'

import type { PipelineFilters } from '../types/prospect.types'

/** Umbral del filtro «sin actividad», en días. */
const STALE_THRESHOLD_DAYS = 7

/**
 * Estado de los filtros del tablero.
 *
 * Por defecto: todas las zonas, los prospectos del usuario en sesión y sin
 * filtro de antigüedad — que es exactamente lo que muestra el diseño.
 *
 * ⚠ El dueño se fija a un id de prueba. Sale de la sesión en cuanto exista el
 * endpoint de identidad; hoy Firebase Auth solo da el token.
 */
const DEFAULT_FILTERS: PipelineFilters = {
  zone: null,
  ownerId: 'usr-ana-ruiz',
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
