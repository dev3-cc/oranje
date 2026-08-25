import type {
  CompleteSignupRequest,
  MyProfile,
  NotificationApi,
  NotificationBoardApi,
} from '../types/worker.types'

import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

/**
 * Fixtures del apartado del Colaborador con las formas del contrato real.
 * «Rosa Navarro»: en BLANCO, con la Fase 1 completa (identidad + las 4
 * decisiones de Oranje, cambio del 2026-08-22) y las fases 2-3 pendientes.
 */

const profile: MyProfile = {
  id: 'wrk-yo',
  fullName: 'Rosa Navarro',
  photoUrl: null,
  birthDate: '1998-04-12',
  age: 28,
  gender: 'FEMALE',
  phone: '+1 404 555 0188',
  address: '1280 Peachtree St NE, Atlanta',
  zone: { id: 'centro', code: 'CENTRO', name: 'Zona Centro' },
  /** Los 4 de Oranje ya vienen de la entrevista: no los captura la persona. */
  position: { id: 'pos-hk', code: 'HOUSEKEEPER', name: 'Housekeeper' },
  englishLevel: { id: 'eng-ba', code: 'BASIC', name: 'Básico' },
  hiringModality: { id: 'mod-ft', code: 'FULL_TIME', name: 'Tiempo completo' },
  experienceLevel: 'ONE_TO_TWO',
  transportType: null,
  emergencyContact: null,
  bloodType: null,
  state: { code: 'WHITE', color: 'Blanco', name: 'Pre-asignación' },
  isProfileComplete: false,
  hasTaxId: false,
  hasAccount: true,
  isBlacklisted: false,
  createdAt: isoDaysAgo(1),
  taxDeadline: {
    status: 'OK',
    day: 2,
    dueAt: isoDaysFromNow(2),
    hasDocument: false,
    isDocumentVerified: false,
    /** D-27: sin cifrado conectado, la retención aplica a todos. */
    taxRetentionApplies: true,
  },
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString()
}

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString()
}

/** Forma CRUDA del board del back: `type` y `entity` anidados. */
const notifications: NotificationApi[] = [
  {
    id: 'ntf-0001',
    type: { code: 'PROFILE_PHASE_PENDING', name: 'Alta pendiente', module: 'worker' },
    title: 'Completa tu alta',
    body: 'Te falta la Fase 2 (transporte y SSN/ITIN) y la Fase 3 (emergencia y salud) para que la Reclutadora pueda validarte.',
    entity: { type: 'worker', id: 'wrk-yo' },
    createdAt: isoHoursAgo(4),
    readAt: null,
  },
  {
    id: 'ntf-0002',
    type: { code: 'PUNCH_REMINDER', name: 'Recordatorio de ponche', module: 'timesheet' },
    title: 'Recuerda ponchar tu entrada',
    body: 'Tu turno en Hyatt Regency Atlanta empieza a las 07:00.',
    entity: { type: 'schedule_entry', id: 'sce-0001' },
    createdAt: isoHoursAgo(9),
    readAt: null,
  },
  {
    id: 'ntf-0003',
    type: { code: 'WELCOME', name: 'Bienvenida', module: 'worker' },
    title: 'Bienvenida a Oranje',
    body: 'Tu registro de la entrevista quedó completo. Nace tu expediente.',
    entity: { type: 'worker', id: 'wrk-yo' },
    createdAt: isoHoursAgo(30),
    readAt: isoHoursAgo(28),
  },
]

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/workers/me',
    /** Copia, no referencia: RTK Query congela lo que recibe y el PATCH muta. */
    resolve: (): ApiEnvelope<MyProfile> => ({
      data: { ...profile, taxDeadline: { ...profile.taxDeadline } },
    }),
  },
  {
    method: 'PATCH',
    path: '/workers/me/signup',
    resolve: ({ body }): ApiEnvelope<MyProfile> => {
      const payload = (body ?? {}) as CompleteSignupRequest
      if (payload.transportType !== undefined) profile.transportType = payload.transportType
      if (payload.bloodType !== undefined) profile.bloodType = payload.bloodType
      if (
        payload.emergencyContactName !== undefined ||
        payload.emergencyContactPhone !== undefined ||
        payload.emergencyContactRelationship !== undefined
      ) {
        profile.emergencyContact = {
          name: payload.emergencyContactName ?? profile.emergencyContact?.name ?? '',
          phone: payload.emergencyContactPhone ?? profile.emergencyContact?.phone ?? '',
          relationship:
            payload.emergencyContactRelationship ?? profile.emergencyContact?.relationship ?? '',
        }
      }
      /** Los 9 de `vw_worker`: con Fase 1 hecha, faltan transporte + emergencia + sangre. */
      profile.isProfileComplete =
        profile.position !== null &&
        profile.englishLevel !== null &&
        profile.hiringModality !== null &&
        profile.experienceLevel !== null &&
        profile.transportType !== null &&
        profile.emergencyContact !== null &&
        profile.bloodType !== null
      return { data: { ...profile, taxDeadline: { ...profile.taxDeadline } } }
    },
  },
  {
    method: 'GET',
    path: '/notifications',
    resolve: (): NotificationBoardApi => {
      const data = notifications
        .map((item) => ({ ...item }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return {
        data,
        meta: {
          page: 1,
          limit: 50,
          total: data.length,
          totalPages: 1,
          unread: data.filter((item) => item.readAt === null).length,
        },
      }
    },
  },
  {
    method: 'POST',
    path: '/notifications/:notificationId/read',
    resolve: ({ params }): ApiEnvelope<NotificationApi> => {
      const found = notifications.find((item) => item.id === params.notificationId)
      if (!found) throw new Error('NOTIFICATION_NOT_FOUND')
      found.readAt = found.readAt ?? new Date().toISOString()
      return { data: { ...found } }
    },
  },
]

let areRoutesRegistered = false

export function registerWorkerMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
}
