/*
 * ⚠ Import entre features, permitido SOLO aquí: los catálogos de posición,
 * modalidad e inglés los registra Requisiciones y `/me` la sesión. Con mocks
 * apagados este módulo es un no-op.
 */
// eslint-disable-next-line no-restricted-imports
import { registerRequisitionsMocks } from '@/features/requisitions/api/requisitionsMocks'
import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type {
  ApiEnvelope,
  CatalogItemApi,
  PaginatedEnvelope,
  StatusRefApi,
  WorkerApi,
} from '@/shared/types/apiContract.types'

/**
 * Fixtures de `personal.worker` en la forma CRUDA de `GET /workers`. Los ids
 * de catálogo son los mismos de Requisiciones (`pos-hk`, `eng-ba`, `mod-ft`)
 * y las zonas, las de Onboarding (`centro`, `norte`, `sur`).
 */

const ZONES: CatalogItemApi[] = [
  { id: 'centro', code: 'CENTRO', name: 'Zona Centro' },
  { id: 'norte', code: 'NORTE', name: 'Zona Norte' },
  { id: 'sur', code: 'SUR', name: 'Zona Sur' },
]

const POSITION: Record<string, CatalogItemApi> = {
  'pos-hk': { id: 'pos-hk', code: 'HOUSEKEEPER', name: 'Housekeeper' },
  'pos-hm': { id: 'pos-hm', code: 'HOUSEMAN', name: 'Houseman' },
  'pos-ln': { id: 'pos-ln', code: 'LAUNDRY', name: 'Laundry' },
  'pos-ck': { id: 'pos-ck', code: 'COOK', name: 'Cocinero' },
}

const ENGLISH: Record<string, CatalogItemApi> = {
  'eng-ba': { id: 'eng-ba', code: 'BASIC', name: 'Básico' },
  'eng-co': { id: 'eng-co', code: 'CONVERSATIONAL', name: 'Conversacional' },
}

const MODALITY: Record<string, CatalogItemApi> = {
  'mod-ft': { id: 'mod-ft', code: 'FULL_TIME', name: 'Tiempo completo' },
  'mod-pt': { id: 'mod-pt', code: 'PART_TIME', name: 'Medio tiempo' },
}

const STATE: Record<string, StatusRefApi> = {
  WHITE: { code: 'WHITE', color: 'Blanco', name: 'Pre-asignación' },
  STRONG_GREEN: { code: 'STRONG_GREEN', color: 'Verde fuerte', name: 'Disponible' },
  ORANGE: { code: 'ORANGE', color: 'Naranja', name: 'Fijo' },
  BROWN: { code: 'BROWN', color: 'Café', name: 'Asignación temporal' },
  GRAY: { code: 'GRAY', color: 'Gris', name: 'Accidentado' },
  BLACK: { code: 'BLACK', color: 'Negro', name: 'Blacklist' },
}

let workerSequence = 0

function buildWorker(input: {
  fullName: string
  age: number
  zoneId: string
  positionId?: string
  englishId?: string
  modalityId?: string
  state: string
  isProfileComplete?: boolean
  isBlacklisted?: boolean
}): WorkerApi {
  workerSequence += 1
  return {
    id: `wrk-${String(workerSequence).padStart(4, '0')}`,
    fullName: input.fullName,
    birthDate: '1995-01-01',
    age: input.age,
    gender: 'FEMALE',
    phone: '+1 404 555 0100',
    address: 'Atlanta, GA',
    zone: ZONES.find((zone) => zone.id === input.zoneId) ?? (ZONES[0] as CatalogItemApi),
    position: input.positionId ? (POSITION[input.positionId] ?? null) : null,
    englishLevel: input.englishId ? (ENGLISH[input.englishId] ?? null) : null,
    hiringModality: input.modalityId ? (MODALITY[input.modalityId] ?? null) : null,
    experienceLevel: 'ONE_TO_TWO',
    transportType: 'PUBLIC',
    emergencyContact: null,
    bloodType: 'O_POS',
    state: STATE[input.state] ?? (STATE.WHITE as StatusRefApi),
    isProfileComplete: input.isProfileComplete ?? true,
    /** D-27: mientras el cifrado no se conecte, `has_tax_id` es siempre false. */
    hasTaxId: false,
    hasAccount: false,
    isBlacklisted: input.isBlacklisted ?? false,
    createdAt: '2026-08-01T12:00:00.000Z',
  }
}

const workers: WorkerApi[] = [
  buildWorker({
    fullName: 'Ana Rivera Gómez',
    age: 29,
    zoneId: 'centro',
    positionId: 'pos-hk',
    englishId: 'eng-ba',
    modalityId: 'mod-ft',
    state: 'STRONG_GREEN',
  }),
  buildWorker({
    fullName: 'Luis Cabrera',
    age: 34,
    zoneId: 'norte',
    positionId: 'pos-hm',
    modalityId: 'mod-ft',
    state: 'ORANGE',
  }),
  buildWorker({
    fullName: 'María Fernanda Ortiz',
    age: 25,
    zoneId: 'centro',
    positionId: 'pos-ln',
    englishId: 'eng-co',
    modalityId: 'mod-pt',
    state: 'STRONG_GREEN',
  }),
  buildWorker({
    fullName: 'Pedro Alcántara',
    age: 31,
    zoneId: 'sur',
    state: 'WHITE',
    isProfileComplete: false,
  }),
  buildWorker({
    fullName: 'Julia Mendoza',
    age: 26,
    zoneId: 'sur',
    positionId: 'pos-ck',
    englishId: 'eng-co',
    modalityId: 'mod-ft',
    state: 'BROWN',
  }),
  buildWorker({
    fullName: 'Rogelio Santos',
    age: 41,
    zoneId: 'norte',
    positionId: 'pos-hk',
    modalityId: 'mod-ft',
    state: 'GRAY',
  }),
  buildWorker({
    fullName: 'Carmen Iturbe',
    age: 38,
    zoneId: 'centro',
    positionId: 'pos-hm',
    modalityId: 'mod-pt',
    state: 'BLACK',
    isBlacklisted: true,
  }),
]

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/catalogs/zones',
    resolve: (): ApiEnvelope<CatalogItemApi[]> => ({ data: ZONES }),
  },
  {
    method: 'GET',
    path: '/workers',
    resolve: ({ search }): PaginatedEnvelope<WorkerApi> => {
      const state = search.get('state')
      const zoneId = search.get('zoneId')
      const positionId = search.get('catalogPositionId')
      const englishId = search.get('englishLevelId')
      const items = workers.filter((worker) => {
        if (state && worker.state.code !== state) return false
        if (zoneId && worker.zone.id !== zoneId) return false
        if (positionId && worker.position?.id !== positionId) return false
        if (englishId && worker.englishLevel?.id !== englishId) return false
        return true
      })
      return { data: items, meta: { page: 1, limit: 100, total: items.length, totalPages: 1 } }
    },
  },
  {
    method: 'POST',
    path: '/workers',
    resolve: ({ body }): ApiEnvelope<WorkerApi> => {
      const payload = (body ?? {}) as {
        fullName?: string
        birthDate?: string
        gender?: string
        phone?: string
        address?: string
        zoneId?: string
      }
      if (!payload.fullName || !payload.birthDate || !payload.zoneId) {
        throw new Error('Faltan datos del alta')
      }
      const created = buildWorker({
        fullName: payload.fullName,
        age: Math.max(
          0,
          Math.floor((Date.now() - new Date(payload.birthDate).getTime()) / 31_557_600_000),
        ),
        zoneId: payload.zoneId,
        state: 'WHITE',
        isProfileComplete: false,
      })
      workers.unshift(created)
      return { data: created }
    },
  },
  {
    method: 'GET',
    path: '/workers/:workerId',
    resolve: ({ params }): ApiEnvelope<WorkerApi> => {
      const found = workers.find((worker) => worker.id === params.workerId)
      if (!found) throw new Error('WORKER_NOT_FOUND')
      return { data: found }
    },
  },
]

/** Para los mocks hermanos de la feature (Blacklist) que solo tienen el id. */
export function mockWorkerName(workerId: string): string {
  return workers.find((worker) => worker.id === workerId)?.fullName ?? 'Colaborador'
}

export function mockWorkerState(workerId: string): string {
  return workers.find((worker) => worker.id === workerId)?.state.code ?? 'WHITE'
}

let areRoutesRegistered = false

export function registerPoolMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
  // Los catálogos de posición/modalidad/inglés viven en Requisiciones.
  registerRequisitionsMocks()
}
