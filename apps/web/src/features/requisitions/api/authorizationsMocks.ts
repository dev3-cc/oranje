import type {
  AuthorizationQueue,
  AuthorizationRequest,
  RequisitionPosition,
  StatusChangeReason,
} from '../types/requisition.types'

import { applyResolution, findAuthoredPositions } from './requisitionsMocks'

import { AUTHORIZATION_TRANSITION, REJECTION_STATUS } from '@/shared/constants/requisitionStatus'
import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'

/**
 * Fixtures de la cola de autorización. ANDAMIO TEMPORAL.
 *
 * La cola es del TERRITORIO, no de la página del tablero: de sus tres
 * requisiciones solo una (`req-0003`) aparece entre las seis filas que pinta el
 * tablero. Por eso la métrica dice 3 y ahí abajo se ve una.
 */
const OFFER_HOLD = null

function pendingSlot(id: string, index: number): RequisitionPosition['slots'][number] {
  // Sin firma no hay oferta: el slot existe pero no sale a la Bolsa.
  return {
    id,
    index,
    status: 'free',
    assigneeName: null,
    assignedAt: null,
    offerChannel: OFFER_HOLD,
  }
}

const POSITIONS_AUTH_0002: RequisitionPosition[] = [
  {
    id: 'auth-0002-pos-1',
    index: 1,
    name: 'Recepcionista bilingüe',
    quantity: 1,
    startDate: '2026-08-18',
    startTime: '14:00',
    english: 'AVANZADO',
    coverage: { filled: 0, total: 1 },
    urgency: 'YELLOW',
    modality: 'NOMINA',
    slots: [pendingSlot('auth-0002-slot-1', 1)],
  },
]

const POSITIONS_AUTH_0003: RequisitionPosition[] = [
  {
    id: 'auth-0003-pos-1',
    index: 1,
    name: 'Guardia de acceso',
    quantity: 2,
    startDate: '2026-08-21',
    startTime: '22:00',
    english: 'BASICO',
    coverage: { filled: 0, total: 2 },
    urgency: 'STRONG_GREEN',
    modality: 'NOMINA',
    slots: [pendingSlot('auth-0003-slot-1', 1), pendingSlot('auth-0003-slot-2', 2)],
  },
  {
    id: 'auth-0003-pos-2',
    index: 2,
    name: 'Monitorista de CCTV',
    quantity: 2,
    startDate: '2026-08-21',
    startTime: '22:00',
    english: 'NO_REQUERIDO',
    coverage: { filled: 0, total: 2 },
    urgency: 'STRONG_GREEN',
    modality: 'POR_EVENTO',
    slots: [pendingSlot('auth-0003-slot-3', 1), pendingSlot('auth-0003-slot-4', 2)],
  },
  {
    id: 'auth-0003-pos-3',
    index: 3,
    name: 'Supervisor de seguridad',
    quantity: 1,
    startDate: '2026-08-21',
    startTime: '22:00',
    english: 'BASICO',
    coverage: { filled: 0, total: 1 },
    urgency: 'STRONG_GREEN',
    modality: 'NOMINA',
    slots: [pendingSlot('auth-0003-slot-5', 1)],
  },
]

/**
 * `req-0003` toma sus posiciones del detalle escrito a mano: es la misma
 * requisición, y duplicarlas aquí garantizaría que un día digan cosas distintas.
 */
const POSITIONS_REQ_0003 = findAuthoredPositions('req-0003') ?? []

let queue: AuthorizationRequest[] = [
  {
    id: 'req-0003',
    number: '202608121115·M9',
    hotelName: 'Hotel Xcaret México',
    department: 'Mantenimiento',
    requestedByName: 'Laura Méndez',
    status: AUTHORIZATION_TRANSITION.from,
    positionCount: 2,
    slotCount: 2,
    startsInDays: 2,
    positions: POSITIONS_REQ_0003,
    urgencyPreview: {
      startDate: '2026-08-14',
      daysAhead: 2,
      urgency: 'RED',
      positionCount: 2,
    },
  },
  {
    id: 'auth-0002',
    number: '202608121402·V3',
    hotelName: 'Iberostar Cancún',
    department: 'Recepción',
    requestedByName: 'Laura Méndez',
    status: AUTHORIZATION_TRANSITION.from,
    positionCount: 1,
    slotCount: 1,
    startsInDays: 6,
    positions: POSITIONS_AUTH_0002,
    urgencyPreview: {
      startDate: '2026-08-18',
      daysAhead: 6,
      urgency: 'YELLOW',
      positionCount: 1,
    },
  },
  {
    id: 'auth-0003',
    number: '202608120955·N5',
    hotelName: 'Grand Velas Riviera',
    department: 'Seguridad',
    requestedByName: 'Laura Méndez',
    status: AUTHORIZATION_TRANSITION.from,
    positionCount: 3,
    slotCount: 5,
    startsInDays: 9,
    positions: POSITIONS_AUTH_0003,
    urgencyPreview: {
      startDate: '2026-08-21',
      daysAhead: 9,
      urgency: 'STRONG_GREEN',
      positionCount: 3,
    },
  },
]

/**
 * `catalogs.status_change_reason`. Es catálogo del backend y no una lista
 * cerrada en código: se administra sin desplegar front, a diferencia del tipo y
 * el resultado de un intento de contacto, que sí viven en el repositorio.
 */
const REASONS: StatusChangeReason[] = [
  { id: 'reason-01', label: 'Presupuesto aprobado por dirección' },
  { id: 'reason-02', label: 'Ocupación proyectada al alza' },
  { id: 'reason-03', label: 'Cobertura de incapacidad' },
  { id: 'reason-04', label: 'Evento con fecha confirmada' },
  { id: 'reason-05', label: 'Fuera de presupuesto del periodo' },
  { id: 'reason-06', label: 'Duplicada con otra requisición' },
  { id: 'reason-07', label: 'Datos incompletos en la solicitud' },
]

function resolve(requisitionId: string, isApproved: boolean): AuthorizationRequest {
  const request = queue.find((item) => item.id === requisitionId)
  if (!request) throw new Error(`La requisición ${requisitionId} ya no espera firma`)

  queue = queue.filter((item) => item.id !== requisitionId)
  applyResolution(requisitionId, isApproved ? AUTHORIZATION_TRANSITION.to : REJECTION_STATUS)

  return request
}

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/requisitions/authorizations',
    /**
     * La cola viaja con las posiciones de cada requisición dentro. Son un puñado
     * de asuntos y quien firma salta entre ellos comparando: pedir el detalle a
     * cada clic metería medio segundo de espera en cada comparación.
     */
    resolve: (): AuthorizationQueue => ({
      items: queue,
      authorizerRole: 'Manager General',
      authorizerScope: 'todos los departamentos de tu hotel',
    }),
  },
  {
    method: 'GET',
    path: '/catalogs/status-change-reasons',
    resolve: (): { items: StatusChangeReason[] } => ({ items: REASONS }),
  },
  {
    method: 'POST',
    path: '/requisitions/:requisitionId/authorize',
    resolve: ({ params }): AuthorizationRequest => resolve(params['requisitionId'] ?? '', true),
  },
  {
    method: 'POST',
    path: '/requisitions/:requisitionId/reject',
    resolve: ({ params }): AuthorizationRequest => resolve(params['requisitionId'] ?? '', false),
  },
]

let areRoutesRegistered = false

export function registerAuthorizationsMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
}
