import type {
  AdminChecklistItem,
  Audit,
  AuditHeader,
  AuditResponseInput,
  AuditType,
  ChecklistItem,
  LastAuditPerWorker,
  ResponseValue,
} from '../types/audit.types'

import type { MockRoute } from '@/shared/lib/mockBaseQuery'
import { registerMockRoutes } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope, PaginatedEnvelope } from '@/shared/types/apiContract.types'

/**
 * Fixtures de `supervision.audit` + `catalogs.audit_checklist_item`, en la
 * forma CRUDA del contrato real (verificado contra el back en
 * `apps/api/src/modules/supervision/audits/` y
 * `apps/api/src/modules/catalogs/manage/audit-checklist-items/`).
 *
 * Dos hoteles con roster propio — el Supervisor solo ve el suyo, pero el
 * historial (`GET /audits`) y el catálogo de reactivos no distinguen quién
 * mira, así que dos hoteles bastan para probar el scope sin inventar una
 * granja de datos.
 */

const HOTEL_A = { id: 'htl-psp-0015', name: 'Villas Coral' }
const HOTEL_B = { id: 'htl-psp-0022', name: 'Hotel Xcaltún' }

const ANA = { id: 'wrk-0001', fullName: 'Ana Rivera Gómez', photoUrl: null }
const LUIS = { id: 'wrk-0002', fullName: 'Luis Cabrera', photoUrl: null }
const MARIA = { id: 'wrk-0003', fullName: 'María Fernanda Ortiz', photoUrl: null }
const JULIA = { id: 'wrk-0005', fullName: 'Julia Mendoza', photoUrl: null }
const PEDRO = { id: 'wrk-0006', fullName: 'Pedro Salinas', photoUrl: null }
const CARMEN = { id: 'wrk-0007', fullName: 'Carmen Ibarra', photoUrl: null }

const WORKERS_BY_HOTEL: Record<
  string,
  Array<{ id: string; fullName: string; photoUrl: string | null }>
> = {
  [HOTEL_A.id]: [ANA, LUIS, MARIA, JULIA],
  [HOTEL_B.id]: [PEDRO, CARMEN],
}

const SUPERVISOR = { id: 'usr-supervisor-01', fullName: 'Jorge Medina' }

/** `supervision.audit_checklist_item`: tal cual el seed real (categorías y textos), peso 1.00 por default. */
interface MockChecklistItem {
  id: string
  auditType: AuditType
  category: string
  code: string
  label: string
  weight: number
  ordinal: number
}

let itemSequence = 0

function checklistItem(
  auditType: AuditType,
  category: string,
  code: string,
  label: string,
  ordinal: number,
): MockChecklistItem {
  itemSequence += 1
  return {
    id: `chk-${String(itemSequence).padStart(3, '0')}`,
    auditType,
    category,
    code,
    label,
    weight: 1,
    ordinal,
  }
}

const CHECKLIST_ITEMS: MockChecklistItem[] = [
  checklistItem(
    'PERSONAL_PRESENTATION',
    'Uniformidad',
    'PP_UNIFORME_COMPLETO_LIMPIO_PLANCHADO',
    'Uniforme completo, limpio y planchado',
    1,
  ),
  checklistItem(
    'PERSONAL_PRESENTATION',
    'Uniformidad',
    'PP_ZAPATOS_SEGURIDAD_REGLAMENTARIOS',
    'Zapatos de seguridad reglamentarios',
    2,
  ),
  checklistItem(
    'PERSONAL_PRESENTATION',
    'Uniformidad',
    'PP_GAFETE_ID_VISIBLE',
    'Gafete/ID visible',
    3,
  ),
  checklistItem('PERSONAL_PRESENTATION', 'Higiene', 'PP_UNAS', 'Uñas', 1),
  checklistItem('PERSONAL_PRESENTATION', 'Higiene', 'PP_CABELLO', 'Cabello', 2),
  checklistItem(
    'PERSONAL_PRESENTATION',
    'Higiene',
    'PP_HIGIENE_PERSONAL_GENERAL',
    'Higiene personal general',
    3,
  ),
  checklistItem(
    'PERSONAL_PRESENTATION',
    'Seguridad',
    'PP_SIN_JOYERIA_EXCESIVA',
    'Sin joyería excesiva',
    1,
  ),
  checklistItem(
    'PERSONAL_PRESENTATION',
    'Seguridad',
    'PP_USO_GUANTES_PROTECCION_SI_APLICA',
    'Uso de guantes/protección si aplica',
    2,
  ),
  checklistItem(
    'PERSONAL_PRESENTATION',
    'Actitud',
    'PP_PUNTUALIDAD_AL_INICIAR_JORNADA',
    'Puntualidad al iniciar jornada',
    1,
  ),
  checklistItem(
    'PERSONAL_PRESENTATION',
    'Actitud',
    'PP_DISPOSICION_Y_CORTESIA',
    'Disposición y cortesía',
    2,
  ),
  checklistItem(
    'ENVIRONMENT',
    'Insumos',
    'AM_QUIMICOS_Y_MATERIALES_SUFICIENTES',
    'Químicos y materiales suficientes',
    1,
  ),
  checklistItem(
    'ENVIRONMENT',
    'Insumos',
    'AM_ASPIRADORAS_CARRITOS_EN_BUEN_ESTADO',
    'Aspiradoras/carritos en buen estado',
    2,
  ),
  checklistItem(
    'ENVIRONMENT',
    'Insumos',
    'AM_LENCERIA_SABANAS_TOALLAS_SUFICIENTE',
    'Lencería (sábanas/toallas) suficiente',
    3,
  ),
  checklistItem(
    'ENVIRONMENT',
    'Relaciones',
    'AM_TRATO_DIGNO_Y_CORDIAL_DEL_PERSONAL_DEL_HOTEL',
    'Trato digno y cordial del personal del hotel',
    1,
  ),
  checklistItem(
    'ENVIRONMENT',
    'Relaciones',
    'AM_COMUNICACION_EFECTIVA_CON_EL_AMA_DE_LLAVES',
    'Comunicación efectiva con el Ama de Llaves',
    2,
  ),
  checklistItem(
    'ENVIRONMENT',
    'Carga laboral',
    'AM_NUMERO_DE_HABITACIONES_ASIGNADAS_ES_JUSTO',
    'Número de habitaciones asignadas es justo',
    1,
  ),
  checklistItem(
    'ENVIRONMENT',
    'Entorno',
    'AM_AREAS_DE_DESCANSO_ADECUADAS',
    'Áreas de descanso adecuadas',
    1,
  ),
]

function codeFromLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function toChecklistItemView(item: MockChecklistItem): ChecklistItem {
  return {
    id: item.id,
    auditType: item.auditType,
    category: item.category,
    label: item.label,
    weight: item.weight.toFixed(2),
    ordinal: item.ordinal,
  }
}

function toAdminChecklistItem(item: MockChecklistItem): AdminChecklistItem {
  return { ...toChecklistItemView(item), code: item.code }
}

const MS_PER_DAY = 86_400_000

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * MS_PER_DAY).toISOString()
}

let auditSequence = 0

function makeAudit(params: {
  auditType: AuditType
  hotel: { id: string; name: string }
  worker: { id: string; fullName: string; photoUrl: string | null } | null
  createdAt: string
  responses: Array<{ item: MockChecklistItem; value: ResponseValue }>
  observations?: string
}): Audit {
  auditSequence += 1
  const scored = params.responses.filter((r) => r.value !== 'N/A')
  const possible = scored.reduce((sum, r) => sum + r.item.weight, 0)
  const earned = scored
    .filter((r) => r.value === 'CUMPLE')
    .reduce((sum, r) => sum + r.item.weight, 0)
  const score = possible === 0 ? 0 : Math.round((earned / possible) * 10000) / 100

  return {
    id: `aud-${String(auditSequence).padStart(4, '0')}`,
    auditType: params.auditType,
    hotel: params.hotel,
    worker: params.worker,
    supervisor: SUPERVISOR,
    score: score.toFixed(2),
    observations: params.observations ?? null,
    createdAt: params.createdAt,
    updatedAt: null,
    responses: params.responses.map((r) => ({
      checklistItemId: r.item.id,
      category: r.item.category,
      label: r.item.label,
      value: r.value,
    })),
  }
}

const PP_ITEMS = CHECKLIST_ITEMS.filter((item) => item.auditType === 'PERSONAL_PRESENTATION')
const ENV_ITEMS = CHECKLIST_ITEMS.filter((item) => item.auditType === 'ENVIRONMENT')

/**
 * Historial variado a propósito: Ana auditada hace poco y bien, Luis hace
 * tiempo y regular, María hoy mismo, Julia NUNCA (para que "tiempo sin
 * auditar" tenga los tres casos: reciente, viejo, nunca) — y un ENVIRONMENT
 * del hotel sin colaborador.
 */
const AUDITS: Audit[] = [
  makeAudit({
    auditType: 'PERSONAL_PRESENTATION',
    hotel: HOTEL_A,
    worker: ANA,
    createdAt: daysAgoIso(3),
    responses: PP_ITEMS.map((item) => ({ item, value: 'CUMPLE' as const })),
    observations: 'Impecable como siempre. Sin observaciones.',
  }),
  makeAudit({
    auditType: 'PERSONAL_PRESENTATION',
    hotel: HOTEL_A,
    worker: LUIS,
    createdAt: daysAgoIso(20),
    responses: PP_ITEMS.map((item, index) => ({
      item,
      value: index === 1 || index === 6 ? 'NO' : 'CUMPLE',
    })),
    observations: 'Zapatos fuera de norma y sin guantes en químicos. Se le advirtió.',
  }),
  makeAudit({
    auditType: 'PERSONAL_PRESENTATION',
    hotel: HOTEL_A,
    worker: MARIA,
    createdAt: daysAgoIso(0),
    responses: PP_ITEMS.map((item) => ({ item, value: 'CUMPLE' as const })),
  }),
  makeAudit({
    auditType: 'ENVIRONMENT',
    hotel: HOTEL_A,
    worker: null,
    createdAt: daysAgoIso(6),
    responses: ENV_ITEMS.map((item, index) => ({
      item,
      value: index === 3 ? 'NO' : index === 5 ? 'N/A' : 'CUMPLE',
    })),
    observations:
      'Ama de llaves reporta fricción con turno nocturno; sin insumos de tina en 302-310.',
  }),
  makeAudit({
    auditType: 'PERSONAL_PRESENTATION',
    hotel: HOTEL_B,
    worker: PEDRO,
    createdAt: daysAgoIso(9),
    responses: PP_ITEMS.map((item) => ({ item, value: 'CUMPLE' as const })),
  }),
]

function auditsOfHotel(hotelId: string): Audit[] {
  return AUDITS.filter((audit) => audit.hotel.id === hotelId)
}

function toHeader(audit: Audit): AuditHeader {
  const { id, auditType, hotel, worker, supervisor, score, observations, createdAt, updatedAt } =
    audit
  return { id, auditType, hotel, worker, supervisor, score, observations, createdAt, updatedAt }
}

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/catalogs/audit-checklist-items',
    resolve: ({ search }): ApiEnvelope<ChecklistItem[]> => {
      const auditType = search.get('auditType')
      const rows = auditType
        ? CHECKLIST_ITEMS.filter((item) => item.auditType === auditType)
        : CHECKLIST_ITEMS
      return {
        data: [...rows]
          .sort(
            (a, b) =>
              a.auditType.localeCompare(b.auditType) ||
              a.category.localeCompare(b.category) ||
              a.ordinal - b.ordinal,
          )
          .map(toChecklistItemView),
      }
    },
  },
  {
    method: 'POST',
    path: '/catalogs/audit-checklist-items',
    resolve: ({ body }): ApiEnvelope<AdminChecklistItem> => {
      const dto = body as {
        auditType: AuditType
        category: string
        label: string
        weight?: number
        ordinal: number
      }
      const code = codeFromLabel(dto.label)
      if (CHECKLIST_ITEMS.some((item) => item.auditType === dto.auditType && item.code === code)) {
        throw new Error('Ya existe un reactivo con ese texto en esta auditoría')
      }
      const created = checklistItem(dto.auditType, dto.category, code, dto.label, dto.ordinal)
      if (dto.weight !== undefined) created.weight = dto.weight
      CHECKLIST_ITEMS.push(created)
      return { data: toAdminChecklistItem(created) }
    },
  },
  {
    method: 'PATCH',
    path: '/catalogs/audit-checklist-items/:id',
    resolve: ({ params, body }): ApiEnvelope<AdminChecklistItem> => {
      const row = CHECKLIST_ITEMS.find((item) => item.id === params['id'])
      if (!row) throw new Error('Ese reactivo no existe')
      const dto = body as {
        category?: string
        label?: string
        weight?: number
        ordinal?: number
      }
      if (dto.category !== undefined) row.category = dto.category
      if (dto.label !== undefined) {
        row.label = dto.label
        row.code = codeFromLabel(dto.label)
      }
      if (dto.weight !== undefined) row.weight = dto.weight
      if (dto.ordinal !== undefined) row.ordinal = dto.ordinal
      return { data: toAdminChecklistItem(row) }
    },
  },
  {
    method: 'DELETE',
    path: '/catalogs/audit-checklist-items/:id',
    resolve: ({ params }): { ok: true } => {
      const index = CHECKLIST_ITEMS.findIndex((item) => item.id === params['id'])
      if (index === -1) throw new Error('Ese reactivo no existe')
      const inUse = AUDITS.some((audit) =>
        audit.responses.some((response) => response.checklistItemId === params['id']),
      )
      if (inUse) {
        throw new Error('Hay auditorías con respuestas a este reactivo: no se puede eliminar')
      }
      CHECKLIST_ITEMS.splice(index, 1)
      return { ok: true }
    },
  },
  {
    method: 'GET',
    path: '/hotels/:hotelId',
    resolve: ({ params }): ApiEnvelope<{ id: string; name: string; photoUrl: string | null }> => {
      const hotel = [HOTEL_A, HOTEL_B].find((item) => item.id === params['hotelId'])
      if (!hotel) throw new Error('HOTEL_NOT_FOUND')
      return { data: { ...hotel, photoUrl: null } }
    },
  },
  {
    method: 'GET',
    path: '/audits/last-per-worker',
    resolve: ({ search }): ApiEnvelope<LastAuditPerWorker[]> => {
      const hotelId = search.get('hotelId') ?? ''
      const workers = WORKERS_BY_HOTEL[hotelId] ?? []
      const personalAudits = auditsOfHotel(hotelId).filter(
        (audit) => audit.auditType === 'PERSONAL_PRESENTATION',
      )
      return {
        data: workers.map((worker) => {
          const ownAudits = personalAudits
            .filter((audit) => audit.worker?.id === worker.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          return {
            workerId: worker.id,
            workerName: worker.fullName,
            photoUrl: worker.photoUrl,
            lastAuditedAt: ownAudits[0]?.createdAt ?? null,
          }
        }),
      }
    },
  },
  {
    method: 'GET',
    path: '/audits/:id',
    resolve: ({ params }): ApiEnvelope<Audit> => {
      const found = AUDITS.find((audit) => audit.id === params['id'])
      if (!found) throw new Error('La auditoría no existe')
      return { data: found }
    },
  },
  {
    method: 'GET',
    path: '/audits',
    resolve: ({ search }): PaginatedEnvelope<AuditHeader> => {
      const hotelId = search.get('hotelId')
      const workerId = search.get('workerId')
      const auditType = search.get('auditType')
      const rows = AUDITS.filter(
        (audit) =>
          (!hotelId || audit.hotel.id === hotelId) &&
          (!workerId || audit.worker?.id === workerId) &&
          (!auditType || audit.auditType === auditType),
      )
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(toHeader)
      return { data: rows, meta: { page: 1, limit: 100, total: rows.length, totalPages: 1 } }
    },
  },
  {
    method: 'POST',
    path: '/audits',
    resolve: ({ body }): ApiEnvelope<Audit> => {
      const dto = body as {
        auditType: AuditType
        hotelId: string
        workerId?: string
        observations?: string
        responses: AuditResponseInput[]
      }
      const hotel = [HOTEL_A, HOTEL_B].find((item) => item.id === dto.hotelId)
      if (!hotel) throw new Error('El hotel no existe')

      if (dto.auditType === 'PERSONAL_PRESENTATION') {
        if (!dto.workerId)
          throw new Error('La auditoría de Presentación Personal exige un colaborador')
        if (!(WORKERS_BY_HOTEL[dto.hotelId] ?? []).some((worker) => worker.id === dto.workerId)) {
          throw new Error('Este colaborador no tiene asignación activa en ese hotel')
        }
      } else if (dto.workerId) {
        throw new Error('La auditoría de Ambiente y Recursos no lleva colaborador')
      }

      const responses = dto.responses.map((response) => {
        const item = CHECKLIST_ITEMS.find(
          (candidate) =>
            candidate.id === response.checklistItemId && candidate.auditType === dto.auditType,
        )
        if (!item) throw new Error('Uno de los reactivos no existe o no es de esta auditoría')
        return { item, value: response.value }
      })

      const worker = dto.workerId
        ? ((WORKERS_BY_HOTEL[dto.hotelId] ?? []).find((item) => item.id === dto.workerId) ?? null)
        : null

      const audit = makeAudit({
        auditType: dto.auditType,
        hotel,
        worker,
        createdAt: new Date().toISOString(),
        responses,
        ...(dto.observations ? { observations: dto.observations } : {}),
      })
      AUDITS.push(audit)
      return { data: audit }
    },
  },
  {
    method: 'PATCH',
    path: '/audits/:id',
    resolve: ({ params, body }): ApiEnvelope<Audit> => {
      const audit = AUDITS.find((item) => item.id === params['id'])
      if (!audit) throw new Error('La auditoría no existe')
      const dto = body as { observations?: string; responses?: AuditResponseInput[] }

      if (dto.responses && dto.responses.length > 0) {
        for (const change of dto.responses) {
          const existing = audit.responses.find((r) => r.checklistItemId === change.checklistItemId)
          if (!existing) throw new Error('Ese reactivo no forma parte de esta auditoría')
          existing.value = change.value
        }
        const items = pickItems(audit)
        const scored = audit.responses
          .map((response) => ({
            value: response.value,
            weight: items.get(response.checklistItemId) ?? 1,
          }))
          .filter((r) => r.value !== 'N/A')
        const possible = scored.reduce((sum, r) => sum + r.weight, 0)
        const earned = scored
          .filter((r) => r.value === 'CUMPLE')
          .reduce((sum, r) => sum + r.weight, 0)
        if (possible === 0)
          throw new Error('No se puede calificar una auditoría donde todos los reactivos son N/A')
        audit.score = (Math.round((earned / possible) * 10000) / 100).toFixed(2)
      }
      if (dto.observations !== undefined) audit.observations = dto.observations
      audit.updatedAt = new Date().toISOString()

      return { data: audit }
    },
  },
]

function pickItems(audit: Audit): Map<string, number> {
  return new Map(
    audit.responses.map((response) => [
      response.checklistItemId,
      CHECKLIST_ITEMS.find((item) => item.id === response.checklistItemId)?.weight ?? 1,
    ]),
  )
}

let areRoutesRegistered = false

export function registerAuditsMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
}

/** Para pruebas: el hotel del Supervisor por default en los fixtures. */
export const MOCK_SUPERVISOR_HOTEL = HOTEL_A
