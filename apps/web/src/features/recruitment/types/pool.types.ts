import type { CatalogPosition, EnglishLevel, HiringModality } from '@/shared/constants/catalogs'
import type { WorkerStatus } from '@/shared/constants/workerStatus'

/**
 * Formas de respuesta del Pool de Colaboradores (`coverage.vw_pool`).
 *
 * ⚠ ESTA VISTA TODAVÍA NO EXISTE EN LA INSTANCIA.
 *
 * `coverage.vw_pool` está en el diagrama, pero la base solo tiene `vw_worker`,
 * `vw_client` y `vw_prospect`, y `app_user` no tiene GRANT sobre el esquema
 * `personal`. Mientras tanto la pantalla vive de fixtures; el día que la vista
 * exista, se apaga la bandera de mocks y nada más.
 *
 * ⚠ Igual que las demás, su lugar es `packages/contracts` (§5).
 */
export interface PoolWorker {
  id: string
  fullName: string
  /**
   * Derivada de la VISTA, no de la tabla: `personal.worker` guarda la fecha de
   * nacimiento. Prisma no soporta columnas GENERATED (D-19), así que el cálculo
   * vive en la vista y el front solo la pinta — que además es lo correcto,
   * porque una edad calculada en el navegador cambia de valor a medianoche.
   */
  age: number
  zoneName: string
  catalogPosition: CatalogPosition
  englishLevel: EnglishLevel
  hiringModality: HiringModality
  status: WorkerStatus
  /** `is_profile_complete`: también derivada de la vista. */
  isProfileComplete: boolean
  /** `has_tax_id`: si tiene ITIN registrado. Derivada de la vista. */
  hasTaxId: boolean
}

export interface WorkerPool {
  items: PoolWorker[]
  /**
   * Cuántos hay en el pool completo, no cuántos se están pintando. Agregado del
   * backend: la tabla es una página.
   */
  total: number
  zoneNames: string[]
}

/** Ningún filtro puesto en esa columna. */
export const ANY_VALUE = 'ALL'

export interface PoolFilters {
  catalogPosition: string
  zoneName: string
  englishLevel: string
  hiringModality: string
  status: string
}

export const EMPTY_POOL_FILTERS: PoolFilters = {
  catalogPosition: ANY_VALUE,
  zoneName: ANY_VALUE,
  englishLevel: ANY_VALUE,
  hiringModality: ANY_VALUE,
  status: ANY_VALUE,
}
