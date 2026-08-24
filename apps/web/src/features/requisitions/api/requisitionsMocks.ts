/*
 * ⚠ Import entre features, permitido SOLO aquí: la composición usa `/hotels`
 * (Onboarding) y `/me` (sesión). Con mocks apagados esto es un no-op.
 */
// eslint-disable-next-line no-restricted-imports
import { registerOnboardingMocks } from '@/features/onboarding/api/onboardingMocks'
import '@/app/sessionApi'
import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type {
  ApiEnvelope,
  AssignmentApi,
  CatalogItemApi,
  PaginatedEnvelope,
  RequisitionApi,
  RequisitionPositionApi,
  StatusRefApi,
} from '@/shared/types/apiContract.types'

/**
 * Fixtures de `demand` en la forma CRUDA del contrato real: requisiciones con
 * sus posiciones, los catálogos del alta y la firma. Los hoteles son los
 * clientes de Onboarding (`htl-psp-0012` …).
 */

// ── Catálogos, con los códigos del seed real ─────────────────────────────────
const DEPARTMENTS: CatalogItemApi[] = [
  { id: 'dep-hk', code: 'HOUSEKEEPING', name: 'Housekeeping' },
  { id: 'dep-fb', code: 'FOOD_BEVERAGE', name: 'Alimentos' },
  { id: 'dep-fd', code: 'FRONT_DESK', name: 'Front Desk' },
]

const POSITIONS: CatalogItemApi[] = [
  { id: 'pos-hk', code: 'HOUSEKEEPER', name: 'Housekeeper' },
  { id: 'pos-hm', code: 'HOUSEMAN', name: 'Houseman' },
  { id: 'pos-ln', code: 'LAUNDRY', name: 'Laundry' },
  { id: 'pos-ck', code: 'COOK', name: 'Cocinero' },
]

const MODALITIES: CatalogItemApi[] = [
  { id: 'mod-ft', code: 'FULL_TIME', name: 'Tiempo completo' },
  { id: 'mod-pt', code: 'PART_TIME', name: 'Medio tiempo' },
  { id: 'mod-tp', code: 'TEMPORARY', name: 'Temporal' },
  { id: 'mod-or', code: 'ON_REQUEST', name: 'Según solicitud' },
]

const ENGLISH: CatalogItemApi[] = [
  { id: 'eng-ba', code: 'BASIC', name: 'Básico' },
  { id: 'eng-in', code: 'INTERMEDIATE', name: 'Intermedio' },
  { id: 'eng-ad', code: 'ADVANCED', name: 'Avanzado' },
  { id: 'eng-co', code: 'CONVERSATIONAL', name: 'Conversacional' },
]

// ── Estados de los dos semáforos, como los sirve la API ──────────────────────
const REQ_STATE: Record<string, StatusRefApi> = {
  APPLE_GREEN: { code: 'APPLE_GREEN', color: 'Verde manzana', name: 'En elaboración' },
  GREEN: { code: 'GREEN', color: 'Verde', name: 'Autorizada' },
  YELLOW: { code: 'YELLOW', color: 'Amarillo', name: 'En proceso' },
  LIGHT_BLUE: { code: 'LIGHT_BLUE', color: 'Azul claro', name: 'Cubierta totalmente' },
}

const URGENCY: Record<string, StatusRefApi> = {
  RED: { code: 'RED', color: 'Rojo', name: '< 72 h' },
  YELLOW: { code: 'YELLOW', color: 'Amarillo', name: '72–120 h' },
  STRONG_GREEN: { code: 'STRONG_GREEN', color: 'Verde fuerte', name: '> 120 h' },
}

const COVERAGE_REF: StatusRefApi = { code: 'RED', color: 'Rojo', name: '0–50%' }

function isoInDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
}

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString()
}

let positionSequence = 0

function buildPosition(input: {
  positionId: string
  departmentId: string
  quantity: number
  filled: number
  startInDays: number
  urgency: string | null
  englishId?: string
  lineNumber: number
}): RequisitionPositionApi {
  positionSequence += 1
  return {
    id: `dpos-${String(positionSequence).padStart(3, '0')}`,
    lineNumber: input.lineNumber,
    position:
      POSITIONS.find((item) => item.id === input.positionId) ?? (POSITIONS[0] as CatalogItemApi),
    hiringModality: MODALITIES[0] as CatalogItemApi,
    englishLevel: input.englishId
      ? (ENGLISH.find((item) => item.id === input.englishId) ?? null)
      : null,
    department:
      DEPARTMENTS.find((item) => item.id === input.departmentId) ??
      (DEPARTMENTS[0] as CatalogItemApi),
    quantity: input.quantity,
    startDate: isoInDays(input.startInDays),
    startTime: '07:00',
    notes: null,
    coverage: COVERAGE_REF,
    urgency: input.urgency ? (URGENCY[input.urgency] ?? null) : null,
    filled: input.filled,
  }
}

function buildRequisition(input: {
  id: string
  number: string
  hotelId: string
  hotelName: string
  state: string
  createdHoursAgo: number
  authorizedHoursAgo?: number
  positions: RequisitionPositionApi[]
}): RequisitionApi {
  return {
    id: input.id,
    number: input.number,
    hotel: { id: input.hotelId, name: input.hotelName },
    state: REQ_STATE[input.state] ?? (REQ_STATE.APPLE_GREEN as StatusRefApi),
    areaManagerUserId: null,
    authorizedBy: input.authorizedHoursAgo === undefined ? null : 'usr-gm',
    authorizedAt:
      input.authorizedHoursAgo === undefined ? null : isoHoursAgo(input.authorizedHoursAgo),
    inspectorId: null,
    positions: input.positions,
    totalSlots: input.positions.reduce((total, position) => total + position.quantity, 0),
    filledSlots: input.positions.reduce((total, position) => total + position.filled, 0),
    createdAt: isoHoursAgo(input.createdHoursAgo),
    updatedAt: null,
  }
}

const requisitions: RequisitionApi[] = [
  // Esperan autorización (APPLE_GREEN): 3, una con más de 48 h.
  buildRequisition({
    id: 'req-0001',
    number: '202608190930·K7',
    hotelId: 'htl-psp-0012',
    hotelName: 'Hotel Puerto Real',
    state: 'APPLE_GREEN',
    createdHoursAgo: 60,
    positions: [
      buildPosition({
        positionId: 'pos-hk',
        departmentId: 'dep-hk',
        quantity: 6,
        filled: 0,
        startInDays: 2,
        urgency: null,
        lineNumber: 1,
      }),
    ],
  }),
  buildRequisition({
    id: 'req-0002',
    number: '202608200815·B2',
    hotelId: 'htl-psp-0013',
    hotelName: 'Grand Costa Nube',
    state: 'APPLE_GREEN',
    createdHoursAgo: 20,
    positions: [
      buildPosition({
        positionId: 'pos-ck',
        departmentId: 'dep-fb',
        quantity: 2,
        filled: 0,
        startInDays: 6,
        urgency: null,
        englishId: 'eng-ba',
        lineNumber: 1,
      }),
      buildPosition({
        positionId: 'pos-hm',
        departmentId: 'dep-hk',
        quantity: 3,
        filled: 0,
        startInDays: 6,
        urgency: null,
        lineNumber: 2,
      }),
    ],
  }),
  buildRequisition({
    id: 'req-0003',
    number: '202608201110·C9',
    hotelId: 'htl-psp-0014',
    hotelName: 'Hotel Mirador',
    state: 'APPLE_GREEN',
    createdHoursAgo: 4,
    positions: [
      buildPosition({
        positionId: 'pos-ln',
        departmentId: 'dep-hk',
        quantity: 2,
        filled: 0,
        startInDays: 9,
        urgency: null,
        lineNumber: 1,
      }),
    ],
  }),
  // Autorizadas trabajando: cobertura parcial y urgencias vivas.
  buildRequisition({
    id: 'req-0004',
    number: '202608120930·K7',
    hotelId: 'htl-psp-0012',
    hotelName: 'Hotel Puerto Real',
    state: 'YELLOW',
    createdHoursAgo: 200,
    authorizedHoursAgo: 190,
    positions: [
      buildPosition({
        positionId: 'pos-hk',
        departmentId: 'dep-hk',
        quantity: 6,
        filled: 4,
        startInDays: 1,
        urgency: 'RED',
        lineNumber: 1,
      }),
    ],
  }),
  buildRequisition({
    id: 'req-0005',
    number: '202608130800·D4',
    hotelId: 'htl-psp-0015',
    hotelName: 'Villas Coral',
    state: 'YELLOW',
    createdHoursAgo: 180,
    authorizedHoursAgo: 170,
    positions: [
      buildPosition({
        positionId: 'pos-hm',
        departmentId: 'dep-hk',
        quantity: 4,
        filled: 1,
        startInDays: 2,
        urgency: 'RED',
        lineNumber: 1,
      }),
      buildPosition({
        positionId: 'pos-hk',
        departmentId: 'dep-hk',
        quantity: 2,
        filled: 2,
        startInDays: 4,
        urgency: 'YELLOW',
        lineNumber: 2,
      }),
    ],
  }),
  buildRequisition({
    id: 'req-0006',
    number: '202608140700·E1',
    hotelId: 'htl-psp-0016',
    hotelName: 'Hotel Las Palmas',
    state: 'GREEN',
    createdHoursAgo: 150,
    authorizedHoursAgo: 140,
    positions: [
      buildPosition({
        positionId: 'pos-ck',
        departmentId: 'dep-fb',
        quantity: 3,
        filled: 0,
        startInDays: 7,
        urgency: 'STRONG_GREEN',
        englishId: 'eng-co',
        lineNumber: 1,
      }),
    ],
  }),
  buildRequisition({
    id: 'req-0007',
    number: '202608150600·F8',
    hotelId: 'htl-psp-0013',
    hotelName: 'Grand Costa Nube',
    state: 'GREEN',
    createdHoursAgo: 120,
    authorizedHoursAgo: 100,
    positions: [
      buildPosition({
        positionId: 'pos-hk',
        departmentId: 'dep-hk',
        quantity: 5,
        filled: 2,
        startInDays: 8,
        urgency: 'STRONG_GREEN',
        lineNumber: 1,
      }),
    ],
  }),
  buildRequisition({
    id: 'req-0008',
    number: '202608160500·G3',
    hotelId: 'htl-psp-0014',
    hotelName: 'Hotel Mirador',
    state: 'YELLOW',
    createdHoursAgo: 100,
    authorizedHoursAgo: 90,
    positions: [
      buildPosition({
        positionId: 'pos-ln',
        departmentId: 'dep-hk',
        quantity: 3,
        filled: 1,
        startInDays: 5,
        urgency: 'YELLOW',
        lineNumber: 1,
      }),
    ],
  }),
]

let requisitionSequence = 8

interface CreateBody {
  hotelId?: string
  positions?: Array<{
    catalogPositionId?: string
    hiringModalityId?: string
    hotelDepartmentId?: string
    englishLevelId?: string
    quantity?: number
    startDate?: string
    startTime?: string
  }>
}

/**
 * `coverage.assignment` por posición. Se siembra UNA por cada unidad de
 * `filled` de los fixtures, para que la pantalla de slots y el conteo del
 * tablero cuenten la misma historia.
 */
const OCCUPANT_NAMES = [
  'María Sandoval',
  'José Rivera',
  'Rosa Navarro',
  'Ernesto Lara',
  'Lucía Prado',
  'Hilda Cortés',
]

const assignmentsByPosition = new Map<string, AssignmentApi[]>()
{
  let occupantIndex = 0
  for (const requisition of requisitions) {
    for (const position of requisition.positions) {
      const seeded: AssignmentApi[] = []
      for (let ordinal = 1; ordinal <= position.filled; ordinal += 1) {
        const name = OCCUPANT_NAMES[occupantIndex % OCCUPANT_NAMES.length] as string
        occupantIndex += 1
        seeded.push({
          id: `asg-seed-${position.id}-${String(ordinal)}`,
          type: 'FIXED',
          status: 'ACTIVE',
          worker: { id: `wrk-seed-${String(occupantIndex)}`, fullName: name },
          slot: { id: `slot-${position.id}-${String(ordinal)}`, ordinal },
          createdAt: requisition.createdAt,
        })
      }
      if (seeded.length > 0) assignmentsByPosition.set(position.id, seeded)
    }
  }
}

/** El picker manda ids del Pool (`wrk-0001`…); el nombre real vive allá. */
const PICKER_NAMES: Record<string, string> = {
  'wrk-0001': 'Ana Rivera Gómez',
  'wrk-0002': 'Luis Cabrera',
  'wrk-0003': 'María Fernanda Ortiz',
  'wrk-0004': 'Pedro Alcántara',
  'wrk-0005': 'Julia Mendoza',
}

function mockWorkerNameById(workerId: string): string {
  return PICKER_NAMES[workerId] ?? 'Colaborador'
}

const catalogRoute = (path: string, items: CatalogItemApi[]): MockRoute => ({
  method: 'GET',
  path,
  resolve: (): ApiEnvelope<CatalogItemApi[]> => ({ data: items }),
})

const routes: readonly MockRoute[] = [
  catalogRoute('/catalogs/hotel-departments', DEPARTMENTS),
  catalogRoute('/catalogs/positions', POSITIONS),
  catalogRoute('/catalogs/hiring-modalities', MODALITIES),
  catalogRoute('/catalogs/english-levels', ENGLISH),
  {
    method: 'GET',
    path: '/requisitions',
    resolve: ({ search }): PaginatedEnvelope<RequisitionApi> => {
      const state = search.get('state')
      const items = requisitions.filter((item) => !state || item.state.code === state)
      return { data: items, meta: { page: 1, limit: 100, total: items.length, totalPages: 1 } }
    },
  },
  {
    method: 'GET',
    path: '/requisitions/:requisitionId',
    resolve: ({ params }): ApiEnvelope<RequisitionApi> => {
      const found = requisitions.find((item) => item.id === params.requisitionId)
      if (!found) throw new Error('REQUISITION_NOT_FOUND')
      return { data: found }
    },
  },
  {
    method: 'GET',
    path: '/requisitions/:requisitionId/assignments',
    resolve: ({ params }): ApiEnvelope<AssignmentApi[]> => {
      const found = requisitions.find((item) => item.id === params.requisitionId)
      if (!found) throw new Error('REQUISITION_NOT_FOUND')
      return {
        data: found.positions.flatMap((position) =>
          (assignmentsByPosition.get(position.id) ?? []).map((item) => ({ ...item })),
        ),
      }
    },
  },
  {
    method: 'POST',
    path: '/assignments',
    /**
     * RR-15 en versión mock: el motor real lo impone con `FOR UPDATE SKIP
     * LOCKED` y aquí se imita la consecuencia — sin slot libre, 409 en texto.
     */
    resolve: ({
      body,
    }): ApiEnvelope<{
      assignment: AssignmentApi
      positionCoverage: string
      requisitionState: string
    }> => {
      const payload = (body ?? {}) as {
        positionId?: string
        workerId?: string
        type?: string
        endDate?: string
      }
      const requisition = requisitions.find((item) =>
        item.positions.some((position) => position.id === payload.positionId),
      )
      const position = requisition?.positions.find((item) => item.id === payload.positionId)
      if (!requisition || !position) throw new Error('POSITION_NOT_FOUND')
      const taken = assignmentsByPosition.get(position.id) ?? []
      if (taken.length >= position.quantity) {
        throw new Error('Otra reclutadora ganó el slot (RR-15): ya no quedan libres')
      }
      const created: AssignmentApi = {
        id: `asg-${String(taken.length + 1)}-${position.id}`,
        type: payload.type ?? 'FIXED',
        status: 'ACTIVE',
        worker: {
          id: payload.workerId ?? '',
          fullName: mockWorkerNameById(payload.workerId ?? ''),
        },
        slot: { id: `slot-${position.id}-${String(taken.length + 1)}`, ordinal: taken.length + 1 },
        createdAt: new Date().toISOString(),
      }
      assignmentsByPosition.set(position.id, [...taken, created])
      position.filled += 1
      requisition.filledSlots += 1
      /** El semáforo de posiciones, en su versión de juguete: lleno = azul. */
      const isFull = position.filled >= position.quantity
      return {
        data: {
          assignment: { ...created },
          positionCoverage: isFull ? 'LIGHT_BLUE' : 'YELLOW',
          requisitionState: requisition.state.code,
        },
      }
    },
  },
  {
    method: 'POST',
    path: '/requisitions',
    resolve: ({ body }): ApiEnvelope<RequisitionApi> => {
      const payload = (body ?? {}) as CreateBody
      if (!payload.hotelId || !payload.positions?.length) throw new Error('Faltan datos')
      requisitionSequence += 1
      positionSequence += 100
      const created = buildRequisition({
        id: `req-${String(requisitionSequence).padStart(4, '0')}`,
        number: `20260821${String(requisitionSequence).padStart(4, '0')}·N${String(requisitionSequence % 10)}`,
        hotelId: payload.hotelId,
        hotelName: 'Hotel nuevo',
        state: 'APPLE_GREEN',
        createdHoursAgo: 0,
        positions: payload.positions.map((position, index) =>
          buildPosition({
            positionId: position.catalogPositionId ?? 'pos-hk',
            departmentId: position.hotelDepartmentId ?? 'dep-hk',
            quantity: position.quantity ?? 1,
            filled: 0,
            startInDays: 7,
            urgency: null,
            ...(position.englishLevelId ? { englishId: position.englishLevelId } : {}),
            lineNumber: index + 1,
          }),
        ),
      })
      requisitions.unshift(created)
      return { data: created }
    },
  },
  {
    method: 'POST',
    path: '/requisitions/:requisitionId/authorize',
    resolve: ({ params }): ApiEnvelope<RequisitionApi> => {
      const found = requisitions.find((item) => item.id === params.requisitionId)
      if (!found) throw new Error('REQUISITION_NOT_FOUND')
      found.state = REQ_STATE.GREEN as StatusRefApi
      found.authorizedAt = new Date().toISOString()
      found.authorizedBy = 'usr-gm'
      /** RR-H-05: la urgencia nace al autorizar, contra la fecha de inicio. */
      for (const position of found.positions) {
        const hours = (new Date(position.startDate).getTime() - Date.now()) / 3_600_000
        position.urgency = (
          hours < 72 ? URGENCY.RED : hours <= 120 ? URGENCY.YELLOW : URGENCY.STRONG_GREEN
        ) as StatusRefApi
      }
      return { data: found }
    },
  },
]

let areRoutesRegistered = false

export function registerRequisitionsMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
  // `/hotels` y `/me`, que la composición consume, viven en otras features.
  registerOnboardingMocks()
}
