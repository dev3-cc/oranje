import type {
  CreateRequisitionPosition,
  CreateRequisitionRequest,
  RequisitionBoard,
  RequisitionDetail,
  RequisitionFormOptions,
  RequisitionRow,
  RequisitionSlot,
  RequisitionStatusEvent,
} from '../types/requisition.types'

import type { RequisitionStatus } from '@/shared/constants/requisitionStatus'
import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'

/**
 * Fixtures de Requisiciones. ANDAMIO TEMPORAL — se borra cuando `apps/api`
 * exponga `GET /requisitions` y `GET /requisitions/:id`.
 *
 * Las filas y las cifras son las de las capturas, para poder comparar pantalla
 * contra maqueta. Los totales del encabezado del tablero NO se derivan de
 * `items`: son agregados de todo el territorio del supervisor, mientras que
 * `items` es la página que se pinta. Por eso el encabezado dice 8 abiertas y se
 * ven 6 filas.
 */
const ITEMS: RequisitionRow[] = [
  {
    id: 'req-0001',
    number: '202608120930·K7',
    hotelName: 'Hotel Xcaret Arte',
    department: 'Ama de llaves',
    // 3 líneas de posición que suman 7 slots, de los que 4 están ocupados: es
    // la misma requisición del detalle, y las dos pantallas tienen que cuadrar.
    positions: 3,
    coverage: { filled: 4, total: 7 },
    urgency: 'ROJO',
    status: 'VERDE',
    authorizedAt: '2026-08-12T09:41:00',
    inspectorName: 'R. Solís',
  },
  {
    id: 'req-0002',
    number: '202608120845·B2',
    hotelName: 'Grand Velas Riviera',
    department: 'Alimentos y Bebidas',
    positions: 1,
    coverage: { filled: 4, total: 4 },
    urgency: 'VERDE',
    status: 'AZUL_CLARO',
    authorizedAt: '2026-08-12T08:52:00',
    inspectorName: 'R. Solís',
  },
  {
    id: 'req-0003',
    number: '202608121115·M9',
    hotelName: 'Hotel Xcaret México',
    department: 'Mantenimiento',
    // 2 líneas de una persona cada una: las mismas que firma el Manager.
    positions: 2,
    coverage: { filled: 0, total: 2 },
    urgency: 'ROJO',
    status: 'VERDE_MANZANA',
    authorizedAt: null,
    inspectorName: 'M. Cruz',
  },
  {
    id: 'req-0004',
    number: '202608111640·T4',
    hotelName: 'Iberostar Cancún',
    department: 'Ama de llaves',
    positions: 1,
    coverage: { filled: 6, total: 8 },
    urgency: 'AMARILLO',
    status: 'AMARILLO',
    authorizedAt: '2026-08-11T17:02:00',
    inspectorName: 'A. Peña',
  },
  {
    id: 'req-0005',
    number: '202608111210·L1',
    hotelName: 'Hotel Xcaret Arte',
    department: 'Recepción',
    positions: 1,
    coverage: { filled: 1, total: 1 },
    urgency: 'VERDE',
    status: 'AZUL_CLARO',
    authorizedAt: '2026-08-11T12:30:00',
    inspectorName: 'R. Solís',
  },
  {
    id: 'req-0006',
    number: '202608101755·Q8',
    hotelName: 'Grand Velas Riviera',
    department: 'Seguridad',
    positions: 1,
    coverage: { filled: 0, total: 3 },
    urgency: 'AMARILLO',
    status: 'MORADO',
    authorizedAt: '2026-08-10T18:10:00',
    inspectorName: 'A. Peña',
  },
]

const BOARD: RequisitionBoard = {
  metrics: {
    openCount: 8,
    openHotels: 4,
    awaitingAuthorization: 3,
    awaitingOver48h: 1,
    partialCoverage: 5,
    freeSlots: 12,
    urgentCount: 2,
    urgentRuleId: 'RR-H-05',
  },
  items: ITEMS,
}

/** Cómo se ofrece un slot que todavía no tiene a nadie. */
const OFFER_CHANNEL = 'Visible en la Bolsa · Self-Pick'

function freeSlot(id: string, index: number): RequisitionSlot {
  return { id, index, status: 'free', assigneeName: null, assignedAt: null, offerChannel: null }
}

/**
 * El detalle de la maqueta, escrito a mano. Los demás se derivan de su fila del
 * tablero para que ninguna sea un callejón sin salida al hacer clic.
 */
const DETAIL_REQ_0001: RequisitionDetail = {
  id: 'req-0001',
  number: '202608120930·K7',
  hotelName: 'Hotel Xcaret Arte',
  department: 'Ama de llaves',
  status: 'VERDE',
  createdByName: 'Laura Méndez',
  createdAt: '2026-08-12T09:30:00',
  authorizedByName: 'Marcela Cruz',
  authorizedAt: '2026-08-12T09:41:00',
  inspectorName: 'Ricardo Solís',
  totals: { positionCount: 3, slotCount: 7, occupiedCount: 4, coverage: 4 / 7 },
  positions: [
    {
      id: 'pos-0001',
      index: 1,
      name: 'Camarista',
      quantity: 4,
      startDate: '2026-08-18',
      startTime: '07:00',
      english: 'BASICO',
      coverage: { filled: 3, total: 4 },
      urgency: 'ROJO',
      modality: 'POR_EVENTO',
      slots: [
        {
          id: 'slot-0001',
          index: 1,
          status: 'occupied',
          assigneeName: 'Ana Rivera Gómez',
          assignedAt: '2026-08-12T10:02:00',
          offerChannel: null,
        },
        {
          id: 'slot-0002',
          index: 2,
          status: 'occupied',
          assigneeName: 'Beatriz Luna Ortiz',
          assignedAt: '2026-08-12T10:15:00',
          offerChannel: null,
        },
        {
          id: 'slot-0003',
          index: 3,
          status: 'occupied',
          assigneeName: 'Carmen Díaz Peña',
          assignedAt: '2026-08-12T11:40:00',
          offerChannel: null,
        },
        {
          id: 'slot-0004',
          index: 4,
          status: 'free',
          assigneeName: null,
          assignedAt: null,
          offerChannel: OFFER_CHANNEL,
        },
      ],
    },
    {
      id: 'pos-0002',
      index: 2,
      name: 'Supervisora de piso',
      quantity: 1,
      startDate: '2026-08-18',
      startTime: '07:00',
      english: 'INTERMEDIO',
      coverage: { filled: 1, total: 1 },
      urgency: 'ROJO',
      modality: 'NOMINA',
      slots: [
        {
          id: 'slot-0005',
          index: 1,
          status: 'occupied',
          assigneeName: 'Diana Ortega Ruiz',
          assignedAt: '2026-08-12T10:30:00',
          offerChannel: null,
        },
      ],
    },
    {
      id: 'pos-0003',
      index: 3,
      name: 'Housekeeper',
      quantity: 2,
      startDate: '2026-08-20',
      startTime: '08:00',
      english: 'NO_REQUERIDO',
      coverage: { filled: 0, total: 2 },
      urgency: 'AMARILLO',
      modality: 'POR_EVENTO',
      slots: [
        { ...freeSlot('slot-0006', 1), offerChannel: OFFER_CHANNEL },
        { ...freeSlot('slot-0007', 2), offerChannel: OFFER_CHANNEL },
      ],
    },
  ],
  history: [
    {
      id: 'evt-0002',
      fromStatus: 'VERDE_MANZANA',
      toStatus: 'VERDE',
      action: 'Autorizada',
      byName: 'Marcela Cruz',
      at: '2026-08-12T09:41:00',
    },
    {
      id: 'evt-0001',
      fromStatus: null,
      toStatus: 'VERDE_MANZANA',
      action: 'Creada',
      byName: 'Laura Méndez',
      at: '2026-08-12T09:30:00',
    },
  ],
}

/**
 * La misma requisición que encabeza la cola de autorización. Se escribe a mano
 * para que las dos pantallas hablen de las mismas dos posiciones: derivarla
 * daría una sola línea llamada «Mantenimiento», y al firmar en una pantalla la
 * otra mostraría algo distinto.
 */
const DETAIL_REQ_0003: RequisitionDetail = {
  id: 'req-0003',
  number: '202608121115·M9',
  hotelName: 'Hotel Xcaret México',
  department: 'Mantenimiento',
  status: 'VERDE_MANZANA',
  createdByName: 'Laura Méndez',
  createdAt: '2026-08-12T11:15:00',
  authorizedByName: null,
  authorizedAt: null,
  inspectorName: 'M. Cruz',
  totals: { positionCount: 2, slotCount: 2, occupiedCount: 0, coverage: 0 },
  positions: [
    {
      id: 'pos-0011',
      index: 1,
      name: 'Técnico de mantenimiento',
      quantity: 1,
      startDate: '2026-08-14',
      startTime: '06:00',
      english: 'BASICO',
      coverage: { filled: 0, total: 1 },
      urgency: 'ROJO',
      modality: 'NOMINA',
      // Sin autorizar no hay nada que ofrecer: los slots existen, pero no salen
      // a la Bolsa hasta que alguien firma.
      slots: [freeSlot('slot-0011', 1)],
    },
    {
      id: 'pos-0012',
      index: 2,
      name: 'Auxiliar de albañilería',
      quantity: 1,
      startDate: '2026-08-14',
      startTime: '06:00',
      english: 'NO_REQUERIDO',
      coverage: { filled: 0, total: 1 },
      urgency: 'ROJO',
      modality: 'POR_EVENTO',
      slots: [freeSlot('slot-0012', 1)],
    },
  ],
  history: [
    {
      id: 'evt-0011',
      fromStatus: null,
      toStatus: 'VERDE_MANZANA',
      action: 'Creada',
      byName: 'Laura Méndez',
      at: '2026-08-12T11:15:00',
    },
  ],
}

/** Nombres de relleno para los slots ocupados de los detalles derivados. */
const FILLER_NAMES = [
  'Ana Rivera Gómez',
  'Beatriz Luna Ortiz',
  'Carmen Díaz Peña',
  'Diana Ortega Ruiz',
  'Elena Vargas Sosa',
  'Fabiola Mena Ríos',
  'Gabriela Nieto Paz',
  'Hilda Robles Cano',
]

/** Inicio de los detalles derivados: fijo, para que las pruebas no dependan de hoy. */
const DERIVED_START_DATE = '2026-08-20'
const DERIVED_START_TIME = '07:00'

/**
 * Corre el reloj de un ISO sin construir un `Date`: solo toca `HH:MM`. Sirve
 * para separar en el tiempo los pasos intermedios de una historia derivada.
 * Si se pasara de medianoche devuelve el original, que en estos fixtures no ocurre.
 */
function plusMinutes(iso: string, minutes: number): string {
  const match = /T(\d{2}):(\d{2})/.exec(iso)
  if (!match) return iso

  const total = Number(match[1]) * 60 + Number(match[2]) + minutes
  if (total >= 24 * 60) return iso

  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return iso.replace(/T\d{2}:\d{2}/, `T${hh}:${mm}`)
}

/**
 * Qué se hizo para llegar a cada estado. Donde existe una forma verbal distinta
 * se usa esa y no el nombre del estado: repetir «Cubierta totalmente» como chip
 * y como título del asiento no agrega nada.
 */
const ACTION_BY_STATUS: Record<RequisitionStatus, string> = {
  VERDE_MANZANA: 'Creada',
  VERDE: 'Autorizada',
  AMARILLO: 'Puesta en proceso',
  AZUL_CLARO: 'Cobertura completada',
  ROJO: 'Cobertura incompleta',
  MORADO: 'Dada de baja',
}

/**
 * El camino desde `VERDE` hasta el estado actual, respetando
 * `REQUISITION_TRANSITIONS`: a `AZUL_CLARO` y a `ROJO` solo se llega pasando
 * por `AMARILLO`. Inventar un salto directo produciría una historia que el
 * backend nunca podría escribir.
 */
const PATH_FROM_VERDE: Record<RequisitionStatus, readonly RequisitionStatus[]> = {
  VERDE_MANZANA: [],
  VERDE: [],
  AMARILLO: ['AMARILLO'],
  AZUL_CLARO: ['AMARILLO', 'AZUL_CLARO'],
  ROJO: ['AMARILLO', 'ROJO'],
  MORADO: ['MORADO'],
}

function buildDerivedHistory(row: RequisitionRow, createdAt: string): RequisitionStatusEvent[] {
  const events: RequisitionStatusEvent[] = [
    {
      id: `${row.id}-evt-1`,
      fromStatus: null,
      toStatus: 'VERDE_MANZANA',
      action: 'Creada',
      byName: 'Laura Méndez',
      at: createdAt,
    },
  ]

  if (row.authorizedAt !== null) {
    events.push({
      id: `${row.id}-evt-2`,
      fromStatus: 'VERDE_MANZANA',
      toStatus: 'VERDE',
      action: 'Autorizada',
      byName: 'Marcela Cruz',
      at: row.authorizedAt,
    })

    let previous: RequisitionStatus = 'VERDE'
    PATH_FROM_VERDE[row.status].forEach((step, index) => {
      events.push({
        id: `${row.id}-evt-${String(index + 3)}`,
        fromStatus: previous,
        toStatus: step,
        action: ACTION_BY_STATUS[step],
        byName: row.inspectorName,
        at: plusMinutes(row.authorizedAt ?? createdAt, (index + 1) * 45),
      })
      previous = step
    })
  }

  return events.reverse()
}

/** Un detalle verosímil para las filas que no tienen maqueta propia. */
function deriveDetail(row: RequisitionRow): RequisitionDetail {
  const createdAt = row.authorizedAt ? plusMinutes(row.authorizedAt, -11) : '2026-08-12T11:15:00'

  const slots: RequisitionSlot[] = Array.from({ length: row.coverage.total }, (_, index) => {
    if (index >= row.coverage.filled) {
      return {
        ...freeSlot(`${row.id}-slot-${String(index + 1)}`, index + 1),
        offerChannel: OFFER_CHANNEL,
      }
    }

    return {
      id: `${row.id}-slot-${String(index + 1)}`,
      index: index + 1,
      status: 'occupied',
      assigneeName: FILLER_NAMES[index % FILLER_NAMES.length] ?? 'Sin nombre',
      assignedAt: plusMinutes(row.authorizedAt ?? createdAt, (index + 1) * 18),
      offerChannel: null,
    }
  })

  return {
    id: row.id,
    number: row.number,
    hotelName: row.hotelName,
    department: row.department,
    status: row.status,
    createdByName: 'Laura Méndez',
    createdAt,
    authorizedByName: row.authorizedAt ? 'Marcela Cruz' : null,
    authorizedAt: row.authorizedAt,
    inspectorName: row.inspectorName,
    totals: {
      positionCount: row.positions,
      slotCount: row.coverage.total,
      occupiedCount: row.coverage.filled,
      coverage: row.coverage.total > 0 ? row.coverage.filled / row.coverage.total : 0,
    },
    positions: [
      {
        id: `${row.id}-pos-1`,
        index: 1,
        name: row.department,
        quantity: row.coverage.total,
        startDate: DERIVED_START_DATE,
        startTime: DERIVED_START_TIME,
        english: 'NO_REQUERIDO',
        coverage: row.coverage,
        urgency: row.urgency,
        modality: 'POR_EVENTO',
        slots,
      },
    ],
    history: buildDerivedHistory(row, createdAt),
  }
}

const DETAILS: Record<string, RequisitionDetail> = {
  [DETAIL_REQ_0001.id]: DETAIL_REQ_0001,
  [DETAIL_REQ_0003.id]: DETAIL_REQ_0003,
}

function findDetail(requisitionId: string): RequisitionDetail {
  const authored = DETAILS[requisitionId]
  if (authored) return authored

  const row = ITEMS.find((item) => item.id === requisitionId)
  if (!row) throw new Error(`No existe la requisición ${requisitionId}`)

  return deriveDetail(row)
}

/**
 * Reloj simulado. Los fixtures viven en agosto de 2026, así que una firma
 * sellada con la hora real de la máquina saldría descolgada del resto — y
 * además haría que las pruebas dependieran del día en que corren.
 */
export const SIMULATED_NOW = '2026-08-12T12:00:00'

/**
 * Aplica en el tablero y en el detalle lo que se resolvió en la pantalla de
 * autorización. Vive aquí porque es este archivo el que guarda el estado del
 * tablero: si la cola lo mutara por su cuenta, habría dos verdades.
 */
export function applyResolution(requisitionId: string, status: RequisitionStatus): void {
  const row = ITEMS.find((item) => item.id === requisitionId)
  if (row) {
    row.status = status
    if (status !== 'MORADO') row.authorizedAt = SIMULATED_NOW
  }

  const detail = DETAILS[requisitionId]
  if (detail) {
    detail.status = status
    if (status !== 'MORADO') {
      detail.authorizedByName = 'Laura Méndez'
      detail.authorizedAt = SIMULATED_NOW
    }
    detail.history = [
      {
        id: `${requisitionId}-evt-firma`,
        fromStatus: 'VERDE_MANZANA',
        toStatus: status,
        action: status === 'MORADO' ? 'Rechazada' : 'Autorizada',
        byName: 'Laura Méndez',
        at: SIMULATED_NOW,
      },
      ...detail.history,
    ]
  }

  // La métrica del tablero es un agregado del territorio: baja una porque esta
  // requisición ya dejó de esperar firma, gane o pierda.
  BOARD.metrics.awaitingAuthorization = Math.max(0, BOARD.metrics.awaitingAuthorization - 1)
}

/** Las posiciones que ya están escritas para una requisición, si las hay. */
export function findAuthoredPositions(
  requisitionId: string,
): RequisitionDetail['positions'] | null {
  return DETAILS[requisitionId]?.positions ?? null
}

/** Hoteles elegibles, con el inspector que les toca por zona (RR-13). */
const HOTEL_OPTIONS: RequisitionFormOptions['hotels'] = [
  { id: 'htl-arte', name: 'Hotel Xcaret Arte', zoneName: 'Centro', inspectorName: 'R. Solís' },
  { id: 'htl-mexico', name: 'Hotel Xcaret México', zoneName: 'Centro', inspectorName: 'M. Cruz' },
  { id: 'htl-velas', name: 'Grand Velas Riviera', zoneName: 'Norte', inspectorName: 'A. Peña' },
  { id: 'htl-iberostar', name: 'Iberostar Cancún', zoneName: 'Norte', inspectorName: 'A. Peña' },
]

const DEPARTMENTS = [
  'Ama de llaves',
  'Alimentos y Bebidas',
  'Mantenimiento',
  'Recepción',
  'Seguridad',
]

const AREA_MANAGERS = [
  { id: 'gh-marcela', name: 'Marcela Cruz' },
  { id: 'gh-laura', name: 'Laura Méndez' },
  { id: 'gh-ricardo', name: 'Ricardo Solís' },
]

/**
 * Homoclave de dos caracteres. En el backend evita que dos altas del mismo
 * minuto choquen; aquí basta con que sea distinta cada vez y estable entre
 * corridas, así que va por secuencia y no al azar.
 */
const HOMOCLAVE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
let requisitionSequence = 0

function nextNumber(): string {
  requisitionSequence += 1
  const stamp = SIMULATED_NOW.replace(/[-:T]/g, '').slice(0, 12)
  const first = HOMOCLAVE_ALPHABET[requisitionSequence % HOMOCLAVE_ALPHABET.length] ?? 'A'
  const second = HOMOCLAVE_ALPHABET[(requisitionSequence * 7) % HOMOCLAVE_ALPHABET.length] ?? 'B'

  return `${stamp}\u00b7${first}${second}`
}

function readCreateRequest(body: unknown): CreateRequisitionRequest {
  if (typeof body !== 'object' || body === null) throw new Error('Falta el cuerpo de la petición')
  return body as CreateRequisitionRequest
}

/**
 * Alta de una requisición.
 *
 * Nace en el estado del que sale la autorización y sin nadie que la haya
 * firmado: `authorizedAt` en nulo. Sus slots existen desde el primer momento
 * —uno por unidad de cantidad (D-02, RR-15)— pero todos libres.
 */
function createRequisition(body: unknown): RequisitionDetail {
  const request = readCreateRequest(body)
  const hotel = HOTEL_OPTIONS.find((item) => item.id === request.hotelId)
  if (!hotel) throw new Error('El hotel no existe en el catálogo')
  if (request.positions.length === 0) throw new Error('Una requisición pide al menos una posición')

  const id = `req-${String(1000 + requisitionSequence)}`
  const number = nextNumber()
  const slotCount = request.positions.reduce((total, position) => total + position.quantity, 0)

  const positions = request.positions.map((position: CreateRequisitionPosition, index) => ({
    id: `${id}-pos-${String(index + 1)}`,
    index: index + 1,
    name: position.positionName,
    quantity: position.quantity,
    startDate: position.startDate,
    startTime: position.startTime,
    english: position.english,
    coverage: { filled: 0, total: position.quantity },
    // La urgencia la calcula el backend contra la fecha de inicio; aquí se
    // deja en el nivel más laxo hasta que alguien autorice y arranque el reloj.
    urgency: 'VERDE' as const,
    modality: position.modality,
    slots: Array.from({ length: position.quantity }, (_, slotIndex) =>
      freeSlot(`${id}-slot-${String(index + 1)}-${String(slotIndex + 1)}`, slotIndex + 1),
    ),
  }))

  const detail: RequisitionDetail = {
    id,
    number,
    hotelName: hotel.name,
    department: request.department,
    status: 'VERDE_MANZANA',
    createdByName: 'Laura Méndez',
    createdAt: SIMULATED_NOW,
    authorizedByName: null,
    authorizedAt: null,
    inspectorName: hotel.inspectorName,
    totals: { positionCount: positions.length, slotCount, occupiedCount: 0, coverage: 0 },
    positions,
    history: [
      {
        id: `${id}-evt-1`,
        fromStatus: null,
        toStatus: 'VERDE_MANZANA',
        action: 'Creada',
        byName: 'Laura Méndez',
        at: SIMULATED_NOW,
      },
    ],
  }

  DETAILS[id] = detail
  ITEMS.unshift({
    id,
    number,
    hotelName: hotel.name,
    department: request.department,
    positions: positions.length,
    coverage: { filled: 0, total: slotCount },
    urgency: 'VERDE',
    status: 'VERDE_MANZANA',
    authorizedAt: null,
    inspectorName: hotel.inspectorName,
  })

  // Sube el agregado del tablero. La cola de autorización vive en el fixture de
  // al lado y no se toca desde aquí: son dos archivos y una sola verdad la
  // tendrá el backend.
  BOARD.metrics.awaitingAuthorization += 1
  BOARD.metrics.openCount += 1

  return detail
}

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/requisitions',
    resolve: (): RequisitionBoard => BOARD,
  },
  {
    method: 'GET',
    path: '/requisitions/form-options',
    resolve: (): RequisitionFormOptions => ({
      hotels: HOTEL_OPTIONS,
      departments: DEPARTMENTS,
      areaManagers: AREA_MANAGERS,
    }),
  },
  {
    method: 'POST',
    path: '/requisitions',
    resolve: ({ body }): RequisitionDetail => createRequisition(body),
  },
  {
    method: 'GET',
    path: '/requisitions/:requisitionId',
    resolve: ({ params }): RequisitionDetail => findDetail(params['requisitionId'] ?? ''),
  },
]

let areRoutesRegistered = false

export function registerRequisitionsMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
}
