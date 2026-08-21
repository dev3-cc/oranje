import type { WorkerStatus } from '@/shared/constants/workerStatus'

/**
 * Formas de la vista del Pool, adaptadas de `GET /workers` (el contrato real:
 * `personal.worker` + `vw_worker`). Posición, inglés y modalidad llegan como
 * su NOMBRE ya resuelto del catálogo; los filtros viajan por id.
 *
 * ⚠ Igual que las demás, su lugar es `packages/contracts` (§5).
 */
export interface PoolWorker {
  id: string
  fullName: string
  /** Derivada de la vista (`vw_worker`): una edad calculada en el navegador cambia a medianoche. */
  age: number
  zoneName: string
  /** `—` mientras el expediente no la registra (fase 2 del alta). */
  catalogPosition: string
  englishLevel: string
  hiringModality: string
  status: WorkerStatus
  /** `is_profile_complete`: los nueve campos que la vista declara obligatorios. */
  isProfileComplete: boolean
  /** `has_tax_id`: mientras el cifrado no se conecte, siempre es `false` (D-27). */
  hasTaxId: boolean
  /** Un vetado se pinta distinto aunque su estado lo diga: es la regla, no un adorno. */
  isBlacklisted: boolean
}

export interface WorkerPool {
  items: PoolWorker[]
  /** Cuántos hay en el pool completo (meta.total), no cuántos se pintan. */
  total: number
}

/** Una fila de catálogo para armar los filtros. */
export interface PoolOption {
  id: string
  name: string
}

export interface PoolOptions {
  positions: PoolOption[]
  zones: PoolOption[]
  englishLevels: PoolOption[]
  modalities: PoolOption[]
}

/** Ningún filtro puesto en esa columna. */
export const ANY_VALUE = 'ALL'

/** Los filtros viajan por ID de catálogo, que es lo que `GET /workers` acepta. */
export interface PoolFilters {
  catalogPositionId: string
  zoneId: string
  englishLevelId: string
  /** El único que la API aún no filtra: se aplica al adaptar. */
  hiringModalityId: string
  status: string
}

export const EMPTY_POOL_FILTERS: PoolFilters = {
  catalogPositionId: ANY_VALUE,
  zoneId: ANY_VALUE,
  englishLevelId: ANY_VALUE,
  hiringModalityId: ANY_VALUE,
  status: ANY_VALUE,
}

/** El cuerpo REAL de `POST /workers` (Fase 1 · Entrevista). */
export interface CreateWorkerRequest {
  fullName: string
  birthDate: string
  /** El CHECK real admite también OTHER, aunque la maqueta enseñe dos. */
  gender: 'MALE' | 'FEMALE' | 'OTHER'
  phone: string
  address: string
  zoneId: string
}
