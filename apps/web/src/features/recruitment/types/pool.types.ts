import type { Readiness } from '../lib/profileFields'

import type { WorkerStatus } from '@/shared/constants/workerStatus'

export interface PoolWorker {
  id: string
  fullName: string
  photoUrl: string | null
  age: number
  zoneName: string
  catalogPosition: string
  englishLevel: string
  hiringModality: string
  status: WorkerStatus
  isProfileComplete: boolean
  /** Si ya se puede meter a una requisición; lo pinta el anillo del avatar. */
  readiness: Readiness
  /** Validado a medias: hasta cuándo puede completar el expediente. */
  profileDueAt: string | null
  hasAccount: boolean
  hasTaxId: boolean
  /** SSN/ITIN cargado y todavía sin revisar: badge "1 pendiente" en la fila. */
  hasPendingDocument: boolean
  createdAt: string
  isBlacklisted: boolean
  /** Dónde está trabajando hoy (asignación ACTIVA más reciente); null sin ninguna. */
  assignment: {
    requisitionId: string
    requisitionNumber: string
    hotelId: string
    hotelName: string
  } | null
}

export interface WorkerPool {
  items: PoolWorker[]
  total: number
}

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

export const ANY_VALUE = 'ALL'
/** El único valor real de `hasPendingDocument`: mismo patrón string+ANY_VALUE
    que el resto de los filtros — así `isFiltered` (PoolPage.tsx) lo detecta
    gratis sin un caso especial para el único filtro que fuera booleano. */
export const PENDING_VALUE = 'PENDING'

export interface PoolFilters {
  /** Por nombre; va al back como `?search=` cuando no está vacío. */
  search: string
  catalogPositionId: string
  zoneId: string
  englishLevelId: string
  hiringModalityId: string
  status: string
  /** `PENDING_VALUE` o `ANY_VALUE` (Hugo, 2026-09-30: con SSN/ITIN pendiente de revisar). */
  hasPendingDocument: string
}

export const EMPTY_POOL_FILTERS: PoolFilters = {
  search: '',
  catalogPositionId: ANY_VALUE,
  zoneId: ANY_VALUE,
  englishLevelId: ANY_VALUE,
  hiringModalityId: ANY_VALUE,
  status: ANY_VALUE,
  hasPendingDocument: ANY_VALUE,
}

export interface CreateWorkerRequest {
  fullName: string
  birthDate: string
  photoPath?: string
  gender: 'MALE' | 'FEMALE' | 'OTHER'
  phone: string
  address: string
  zoneId: string
  catalogPositionId?: string
  hiringModalityId?: string
  englishLevelId?: string
  experienceLevel?: string
  /** Fases 2 y 3, opcionales: si la Reclutadora ya las tiene, las captura aquí. */
  transportType?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelationship?: string
  bloodType?: string
}

/** Lo que devuelve `POST /workers/:id/access`, una sola vez. */
export interface WorkerAccessCredential {
  email: string
  password: string
  mailbox: { created: true } | { created: false; reason: string }
}
