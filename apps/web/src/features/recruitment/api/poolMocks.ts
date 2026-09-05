/*
 * ⚠ Import entre features, permitido SOLO aquí: los catálogos de posición,
 * modalidad e inglés los registra Requisiciones y `/me` la sesión. Con mocks
 * apagados este módulo es un no-op.
 */
// eslint-disable-next-line no-restricted-imports
import { registerRequisitionsMocks } from '@/features/requisitions/api/requisitionsMocks'
import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import { matchesSearch } from '@/shared/lib/text'
import type {
  ApiEnvelope,
  CatalogItemApi,
  PaginatedEnvelope,
  StatusRefApi,
  WorkerApi,
  WorkerDocumentApi,
  WorkerDocumentListApi,
  WorkerHistoryEntryApi,
  WorkerTransitionApi,
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
  PINK: { code: 'PINK', color: 'Rosa', name: 'Stand-by' },
  GRAY: { code: 'GRAY', color: 'Gris', name: 'Accidentado' },
  BLACK: { code: 'BLACK', color: 'Negro', name: 'Blacklist' },
}

let workerSequence = 0

function buildWorker(input: {
  fullName: string
  photoUrl?: string
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
    /** La foto llega por URL (Fase 1 web) o por la app móvil (Fase 2). */
    photoUrl: input.photoUrl ?? null,
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

/** Ana llegó a la Fase 3: su expediente sí tiene contacto de emergencia. */
Object.assign(workers[0] as WorkerApi, {
  emergencyContact: { name: 'Rubén Sandoval', phone: '+1 404 512 8890', relationship: 'SIBLING' },
})

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
      /** Como el back: por nombre, sin distinguir acentos ni mayúsculas. */
      const term = search.get('search')
      const state = search.get('state')
      const zoneId = search.get('zoneId')
      const positionId = search.get('catalogPositionId')
      const englishId = search.get('englishLevelId')
      const items = workers.filter((worker) => {
        if (term && !matchesSearch(term, worker.fullName)) return false
        if (state && worker.state.code !== state) return false
        if (zoneId && worker.zone.id !== zoneId) return false
        if (positionId && worker.position?.id !== positionId) return false
        if (englishId && worker.englishLevel?.id !== englishId) return false
        return true
      })
      /** Copias, no referencias: RTK congela lo servido y las transiciones mutan. */
      return {
        data: items.map((worker) => ({ ...worker })),
        meta: { page: 1, limit: 100, total: items.length, totalPages: 1 },
      }
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
        photoPath?: string
        catalogPositionId?: string
        hiringModalityId?: string
        englishLevelId?: string
        experienceLevel?: string
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
        ...(payload.catalogPositionId ? { positionId: payload.catalogPositionId } : {}),
        ...(payload.hiringModalityId ? { modalityId: payload.hiringModalityId } : {}),
        ...(payload.englishLevelId ? { englishId: payload.englishLevelId } : {}),
        state: 'WHITE',
        isProfileComplete: false,
      })
      workers.unshift(created)
      return { data: created }
    },
  },
  {
    method: 'PATCH',
    path: '/workers/:workerId',
    resolve: ({ params, body }): ApiEnvelope<WorkerApi> => {
      const found = workers.find((worker) => worker.id === params.workerId)
      if (!found) throw new Error('WORKER_NOT_FOUND')
      const payload = (body ?? {}) as Partial<{
        fullName: string
        phone: string
        address: string
        zoneId: string
        catalogPositionId: string
        hiringModalityId: string
        englishLevelId: string
        experienceLevel: string
        photoPath: string
      }>
      if (payload.fullName !== undefined) found.fullName = payload.fullName
      if (payload.phone !== undefined) found.phone = payload.phone
      if (payload.address !== undefined) found.address = payload.address
      if (payload.zoneId !== undefined) {
        found.zone = ZONES.find((zone) => zone.id === payload.zoneId) ?? found.zone
      }
      if (payload.catalogPositionId !== undefined) {
        found.position = POSITION[payload.catalogPositionId] ?? found.position
      }
      if (payload.hiringModalityId !== undefined) {
        found.hiringModality = MODALITY[payload.hiringModalityId] ?? found.hiringModality
      }
      if (payload.englishLevelId !== undefined) {
        found.englishLevel = ENGLISH[payload.englishLevelId] ?? found.englishLevel
      }
      if (payload.experienceLevel !== undefined) found.experienceLevel = payload.experienceLevel
      return { data: { ...found } }
    },
  },
  {
    method: 'GET',
    path: '/workers/:workerId',
    resolve: ({ params }): ApiEnvelope<WorkerApi> => {
      const found = workers.find((worker) => worker.id === params.workerId)
      if (!found) throw new Error('WORKER_NOT_FOUND')
      return { data: { ...found } }
    },
  },
  {
    method: 'GET',
    path: '/workers/:workerId/history',
    resolve: ({ params }): ApiEnvelope<WorkerHistoryEntryApi[]> => ({
      data: historyOf(params.workerId ?? '').map((entry) => ({ ...entry })),
    }),
  },
  {
    method: 'GET',
    path: '/workers/:workerId/transitions',
    resolve: ({ params }): ApiEnvelope<WorkerTransitionApi[]> => {
      const found = workers.find((worker) => worker.id === params.workerId)
      if (!found) throw new Error('WORKER_NOT_FOUND')
      return { data: transitionsFor(found.state.code) }
    },
  },
  {
    method: 'POST',
    path: '/workers/:workerId/transitions',
    resolve: ({ params, body }): ApiEnvelope<WorkerApi> => {
      const found = workers.find((worker) => worker.id === params.workerId)
      if (!found) throw new Error('WORKER_NOT_FOUND')
      const payload = (body ?? {}) as { toState?: string; note?: string }
      const allowed = transitionsFor(found.state.code)
      const option = allowed.find((transition) => transition.toState === payload.toState)
      if (!option || !payload.toState) throw new Error('TRANSITION_NOT_ALLOWED')
      const target = STATE[payload.toState]
      if (!target) throw new Error('TRANSITION_NOT_ALLOWED')
      historyOf(found.id).unshift({
        id: `wsh-${String(Date.now())}`,
        fromState: found.state.code,
        toState: payload.toState,
        reason: payload.note ?? null,
        occurredAt: new Date().toISOString(),
        userName: 'Diana Roldán',
      })
      found.state = target
      return { data: { ...found } }
    },
  },
  {
    method: 'GET',
    path: '/workers/:workerId/documents',
    resolve: ({ params }): WorkerDocumentListApi => ({
      data: (DOCUMENTS[params.workerId ?? ''] ?? []).map((doc) => ({ ...doc })),
      /** D-27: el cifrado no está conectado — la retención del 16% aplica a todos. */
      meta: { hasTaxId: false, taxRetentionApplies: true },
    }),
  },
  {
    method: 'POST',
    path: '/workers/:workerId/documents',
    resolve: ({ params, body }): { data: null } => {
      const workerId = params.workerId ?? ''
      const dto = body as { documentType: string; filePath: string }
      const list = DOCUMENTS[workerId] ?? (DOCUMENTS[workerId] = [])
      list.unshift({
        id: `doc-${String(Date.now())}`,
        documentType: dto.documentType,
        filePath: dto.filePath,
        url: null,
        isVerified: false,
        verifiedBy: null,
        verifiedAt: null,
        createdAt: new Date().toISOString(),
      })
      return { data: null }
    },
  },
  {
    method: 'POST',
    path: '/workers/:workerId/documents/:documentId/verify',
    resolve: ({ params }): { data: null } => {
      const doc = (DOCUMENTS[params.workerId ?? ''] ?? []).find(
        (item) => item.id === params.documentId,
      )
      if (!doc) throw new Error('DOCUMENT_NOT_FOUND')
      doc.isVerified = true
      doc.verifiedBy = { id: 'usr-diana', fullName: 'Diana Roldán' }
      doc.verifiedAt = new Date().toISOString()
      return { data: null }
    },
  },
  {
    method: 'DELETE',
    path: '/workers/:workerId/documents/:documentId',
    resolve: ({ params }): { data: null } => {
      const workerId = params.workerId ?? ''
      DOCUMENTS[workerId] = (DOCUMENTS[workerId] ?? []).filter(
        (item) => item.id !== params.documentId,
      )
      return { data: null }
    },
  },
]

/**
 * Lo que la RECLUTADORA (ROL-R-01) puede disparar, copiado del seed real:
 * valida el alta (WHITE→STRONG_GREEN, RF-08) y asigna temporal (→BROWN, con
 * cancelación manual que devuelve al previo). Lo demás es del sistema, del
 * hotel o del Inspector, así que aquí la lista sale vacía.
 */
function transitionsFor(stateCode: string): WorkerTransitionApi[] {
  switch (stateCode) {
    case 'WHITE':
      return [{ toState: 'STRONG_GREEN', requiresReason: false }]
    case 'STRONG_GREEN':
    case 'YELLOW':
      return [{ toState: 'BROWN', requiresReason: false }]
    case 'BROWN':
      return [
        { toState: 'STRONG_GREEN', requiresReason: false },
        /** Stand-by: solo desde estados operativos, y con motivo (seed). */
        { toState: 'PINK', requiresReason: true },
      ]
    case 'APPLE_GREEN':
    case 'LIGHT_BLUE':
    case 'ORANGE':
      return [{ toState: 'PINK', requiresReason: true }]
    case 'PINK':
      return [{ toState: 'STRONG_GREEN', requiresReason: false }]
    default:
      return []
  }
}

const HISTORY: Record<string, WorkerHistoryEntryApi[]> = {
  /** Ana: el recorrido real del seed — alta, validación y una temporal cerrada. */
  'wrk-0001': [
    {
      id: 'wsh-0004',
      fromState: 'BROWN',
      toState: 'STRONG_GREEN',
      reason: 'Vencen los días asignados',
      occurredAt: '2026-08-10T15:00:00.000Z',
      userName: 'Sistema',
    },
    {
      id: 'wsh-0003',
      fromState: 'STRONG_GREEN',
      toState: 'BROWN',
      reason: null,
      occurredAt: '2026-08-06T15:00:00.000Z',
      userName: 'Diana Roldán',
    },
    {
      id: 'wsh-0002',
      fromState: 'WHITE',
      toState: 'STRONG_GREEN',
      reason: 'Alta completada (RF-08)',
      occurredAt: '2026-08-03T15:00:00.000Z',
      userName: 'Diana Roldán',
    },
    {
      id: 'wsh-0001',
      fromState: null,
      toState: 'WHITE',
      reason: 'Fase 1 · entrevista',
      occurredAt: '2026-08-01T15:00:00.000Z',
      userName: 'Diana Roldán',
    },
  ],
}

/** Todo worker tiene al menos su nacimiento en BLANCO (Fase 1). */
function historyOf(workerId: string): WorkerHistoryEntryApi[] {
  HISTORY[workerId] ??= [
    {
      id: `wsh-${workerId}`,
      fromState: null,
      toState: 'WHITE',
      reason: 'Fase 1 · entrevista',
      occurredAt: '2026-08-01T15:00:00.000Z',
      userName: 'Diana Roldán',
    },
  ]
  return HISTORY[workerId]
}

const DOCUMENTS: Record<string, WorkerDocumentApi[]> = {
  'wrk-0001': [
    {
      id: 'doc-0001',
      documentType: 'ID',
      filePath: 'workers/document/ine-frente.pdf',
      url: null,
      isVerified: true,
      verifiedBy: { id: 'usr-recl', fullName: 'Diana Roldán' },
      verifiedAt: '2026-08-03T15:00:00.000Z',
      createdAt: '2026-08-01T15:00:00.000Z',
    },
    {
      id: 'doc-0002',
      documentType: 'PROOF_OF_ADDRESS',
      filePath: 'workers/document/cfe-julio.pdf',
      url: null,
      isVerified: true,
      verifiedBy: { id: 'usr-recl', fullName: 'Diana Roldán' },
      verifiedAt: '2026-08-03T15:00:00.000Z',
      createdAt: '2026-08-01T15:00:00.000Z',
    },
    {
      id: 'doc-0003',
      documentType: 'SSN_ITIN',
      filePath: 'workers/document/itin.pdf',
      url: null,
      isVerified: false,
      verifiedBy: null,
      verifiedAt: null,
      createdAt: '2026-08-02T15:00:00.000Z',
    },
  ],
}

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
