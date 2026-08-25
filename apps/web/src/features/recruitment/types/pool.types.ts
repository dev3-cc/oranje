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
  hasTaxId: boolean
  createdAt: string
  isBlacklisted: boolean
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

export interface PoolFilters {
  catalogPositionId: string
  zoneId: string
  englishLevelId: string
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
}
