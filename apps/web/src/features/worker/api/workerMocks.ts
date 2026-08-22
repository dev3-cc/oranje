import type { MyProfile, NotificationApi, NotificationBoardApi } from '../types/worker.types'

/*
 * ⚠ Import entre features, permitido SOLO aquí: los catálogos de posición,
 * inglés y modalidad que la Fase 2 elige los registra Requisiciones.
 */
// eslint-disable-next-line no-restricted-imports
import { registerRequisitionsMocks } from '@/features/requisitions/api/requisitionsMocks'
import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

/**
 * Fixtures del apartado del Colaborador, con la forma del contrato que la
 * sesión de backend está construyendo. «Rosa N.» de la maqueta: en Blanco,
 * con la Fase 1 hecha y las fases 2-3 pendientes.
 */

const profile: MyProfile = {
  id: 'wrk-yo',
  fullName: 'Rosa Navarro',
  photoUrl: null,
  statusCode: 'WHITE',
  statusLabel: 'Pre-asignación',
  isProfileComplete: false,
  catalogPositionId: null,
  englishLevelId: null,
  hiringModalityId: null,
  experienceLevel: null,
  transportType: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  emergencyContactRelationship: null,
  bloodType: null,
  medicalNotes: null,
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
    body: 'Te falta la Fase 2 (perfil laboral) y la Fase 3 (emergencia y salud) para que la Reclutadora pueda validarte.',
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
    resolve: (): ApiEnvelope<MyProfile> => ({ data: { ...profile } }),
  },
  {
    method: 'PATCH',
    path: '/workers/me',
    resolve: ({ body }): ApiEnvelope<MyProfile> => {
      const payload = (body ?? {}) as Partial<MyProfile> & { photoPath?: string }
      Object.assign(profile, {
        ...(payload.catalogPositionId !== undefined
          ? { catalogPositionId: payload.catalogPositionId }
          : {}),
        ...(payload.englishLevelId !== undefined ? { englishLevelId: payload.englishLevelId } : {}),
        ...(payload.hiringModalityId !== undefined
          ? { hiringModalityId: payload.hiringModalityId }
          : {}),
        ...(payload.experienceLevel !== undefined
          ? { experienceLevel: payload.experienceLevel }
          : {}),
        ...(payload.transportType !== undefined ? { transportType: payload.transportType } : {}),
        ...(payload.emergencyContactName !== undefined
          ? { emergencyContactName: payload.emergencyContactName }
          : {}),
        ...(payload.emergencyContactPhone !== undefined
          ? { emergencyContactPhone: payload.emergencyContactPhone }
          : {}),
        ...(payload.emergencyContactRelationship !== undefined
          ? { emergencyContactRelationship: payload.emergencyContactRelationship }
          : {}),
        ...(payload.bloodType !== undefined ? { bloodType: payload.bloodType } : {}),
        ...(payload.medicalNotes !== undefined ? { medicalNotes: payload.medicalNotes } : {}),
      })
      /** Los 9 de `vw_worker`: con fase 2 y 3 completas, el perfil cierra. */
      profile.isProfileComplete =
        profile.catalogPositionId !== null &&
        profile.englishLevelId !== null &&
        profile.hiringModalityId !== null &&
        profile.experienceLevel !== null &&
        profile.transportType !== null &&
        profile.emergencyContactName !== null &&
        profile.emergencyContactPhone !== null &&
        profile.emergencyContactRelationship !== null &&
        profile.bloodType !== null
      return { data: { ...profile } }
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
  registerRequisitionsMocks()
  registerMockRoutes(routes)
}
