import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../infra/prisma/index.js'

export interface StateDurationRow {
  code: string
  name: string
  transitions: number
  avgHours: number | null
}

export interface StateSnapshotRow {
  code: string
  name: string
  count: number
}

/** Promedio de vida completa: de la primera transición registrada a ahora, sobre todas las entidades con historial. */
export interface TotalDurationRow {
  entities: number
  avgTotalHours: number | null
}

export interface SpanSummaryRow {
  resolved: number
  pending: number
  avgHours: number | null
}

export interface PunchRow {
  id: string
  type: string
  serverAt: Date
  insideGeofence: boolean | null
  isManual: boolean
  workerId: string
  workerFullName: string
  hotelId: string
  hotelName: string
  /** Inicio del turno programado ese día (`operations.schedule_entry`), si existe. */
  scheduledStart: Date | null
  /**
   * Minutos de diferencia entre la marca y el inicio programado — solo para
   * CLOCK_IN, y solo si hay turno ese día. Positivo = tarde, negativo = antes.
   * No hay tolerancia inventada: el número crudo, para que quien mira decida.
   */
  lateMinutes: number | null
}

@Injectable()
export class ObservabilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Los 3 semáforos con historial append-only completo (Worker, Requisición,
  // Onboarding): la duración real por estado, con LEAD() sobre la tabla de
  // historia — quien sigue sin transición todavía sigue en ese estado, y su
  // tramo se mide contra `now()`.
  async workerStateDurations(): Promise<StateDurationRow[]> {
    return this.prisma.$queryRaw<StateDurationRow[]>`
      WITH transitions AS (
        SELECT to_state_id,
               occurred_at,
               LEAD(occurred_at) OVER (PARTITION BY worker_id ORDER BY occurred_at) AS next_at
          FROM personal.worker_state_history
      )
      SELECT sls.code, sls.name,
             COUNT(*)::int AS transitions,
             AVG(EXTRACT(EPOCH FROM (COALESCE(t.next_at, now()) - t.occurred_at)) / 3600)::float8 AS "avgHours"
        FROM transitions t
        JOIN catalogs.status_light_state sls ON sls.id = t.to_state_id
       GROUP BY sls.code, sls.name, sls.display_order
       ORDER BY sls.display_order`
  }

  // El total: de la primera transición registrada (nace en Blanco) a ahora,
  // promediado sobre cada colaborador con historial — no la suma de los
  // promedios por estado, que mentiría sobre quien pasó por menos estados.
  async workerTotalDuration(): Promise<TotalDurationRow> {
    const rows = await this.prisma.$queryRaw<TotalDurationRow[]>`
      SELECT COUNT(*)::int AS entities,
             AVG(EXTRACT(EPOCH FROM (now() - started_at)) / 3600)::float8 AS "avgTotalHours"
        FROM (
          SELECT worker_id, MIN(occurred_at) AS started_at
            FROM personal.worker_state_history
           GROUP BY worker_id
        ) first_seen`
    return rows[0] ?? { entities: 0, avgTotalHours: null }
  }

  async requisitionStateDurations(): Promise<StateDurationRow[]> {
    return this.prisma.$queryRaw<StateDurationRow[]>`
      WITH transitions AS (
        SELECT to_state_id,
               occurred_at,
               LEAD(occurred_at) OVER (PARTITION BY requisition_id ORDER BY occurred_at) AS next_at
          FROM demand.requisition_state_history
      )
      SELECT sls.code, sls.name,
             COUNT(*)::int AS transitions,
             AVG(EXTRACT(EPOCH FROM (COALESCE(t.next_at, now()) - t.occurred_at)) / 3600)::float8 AS "avgHours"
        FROM transitions t
        JOIN catalogs.status_light_state sls ON sls.id = t.to_state_id
       GROUP BY sls.code, sls.name, sls.display_order
       ORDER BY sls.display_order`
  }

  async requisitionTotalDuration(): Promise<TotalDurationRow> {
    const rows = await this.prisma.$queryRaw<TotalDurationRow[]>`
      SELECT COUNT(*)::int AS entities,
             AVG(EXTRACT(EPOCH FROM (now() - started_at)) / 3600)::float8 AS "avgTotalHours"
        FROM (
          SELECT requisition_id, MIN(occurred_at) AS started_at
            FROM demand.requisition_state_history
           GROUP BY requisition_id
        ) first_seen`
    return rows[0] ?? { entities: 0, avgTotalHours: null }
  }

  async onboardingStateDurations(): Promise<StateDurationRow[]> {
    return this.prisma.$queryRaw<StateDurationRow[]>`
      WITH transitions AS (
        SELECT to_state_id,
               occurred_at,
               LEAD(occurred_at) OVER (PARTITION BY prospect_id ORDER BY occurred_at) AS next_at
          FROM commercial.prospect_state_history
      )
      SELECT sls.code, sls.name,
             COUNT(*)::int AS transitions,
             AVG(EXTRACT(EPOCH FROM (COALESCE(t.next_at, now()) - t.occurred_at)) / 3600)::float8 AS "avgHours"
        FROM transitions t
        JOIN catalogs.status_light_state sls ON sls.id = t.to_state_id
       GROUP BY sls.code, sls.name, sls.display_order
       ORDER BY sls.display_order`
  }

  async onboardingTotalDuration(): Promise<TotalDurationRow> {
    const rows = await this.prisma.$queryRaw<TotalDurationRow[]>`
      SELECT COUNT(*)::int AS entities,
             AVG(EXTRACT(EPOCH FROM (now() - started_at)) / 3600)::float8 AS "avgTotalHours"
        FROM (
          SELECT prospect_id, MIN(occurred_at) AS started_at
            FROM commercial.prospect_state_history
           GROUP BY prospect_id
        ) first_seen`
    return rows[0] ?? { entities: 0, avgTotalHours: null }
  }

  // Posiciones de la Requisición y Urgencia: solo tienen columna de estado
  // ACTUAL, sin historia — foto de ahorita, nunca "cuánto tardó".
  async positionCoverageSnapshot(): Promise<StateSnapshotRow[]> {
    return this.prisma.$queryRaw<StateSnapshotRow[]>`
      SELECT sls.code, sls.name, COUNT(*)::int AS count
        FROM demand."position" p
        JOIN catalogs.status_light_state sls ON sls.id = p.coverage_state_id
       GROUP BY sls.code, sls.name, sls.display_order
       ORDER BY sls.display_order`
  }

  async urgencySnapshot(): Promise<StateSnapshotRow[]> {
    return this.prisma.$queryRaw<StateSnapshotRow[]>`
      SELECT sls.code, sls.name, COUNT(*)::int AS count
        FROM demand."position" p
        JOIN catalogs.status_light_state sls ON sls.id = p.urgency_state_id
       WHERE p.urgency_state_id IS NOT NULL
       GROUP BY sls.code, sls.name, sls.display_order
       ORDER BY sls.display_order`
  }

  // Revisión del Día y Aprobación de la Semana: no son del sistema genérico de
  // semáforos (sin `status_light_state`), pero sí tienen un par de timestamps
  // que permiten aproximar UN tramo — de creado a revisado/aprobado — sin el
  // detalle de estados intermedios que sí da un historial de verdad.
  async dayReviewSpan(): Promise<SpanSummaryRow> {
    const rows = await this.prisma.$queryRaw<SpanSummaryRow[]>`
      SELECT COUNT(*) FILTER (WHERE reviewed_at IS NOT NULL)::int AS resolved,
             COUNT(*) FILTER (WHERE reviewed_at IS NULL)::int AS pending,
             (AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 3600)
               FILTER (WHERE reviewed_at IS NOT NULL))::float8 AS "avgHours"
        FROM operations.timesheet_day`
    return rows[0] ?? { resolved: 0, pending: 0, avgHours: null }
  }

  async weekApprovalSpan(): Promise<SpanSummaryRow> {
    const rows = await this.prisma.$queryRaw<SpanSummaryRow[]>`
      SELECT COUNT(*) FILTER (WHERE approved_at IS NOT NULL)::int AS resolved,
             COUNT(*) FILTER (WHERE approved_at IS NULL)::int AS pending,
             (AVG(EXTRACT(EPOCH FROM (approved_at - created_at)) / 3600)
               FILTER (WHERE approved_at IS NOT NULL))::float8 AS "avgHours"
        FROM operations.timesheet`
    return rows[0] ?? { resolved: 0, pending: 0, avgHours: null }
  }

  // El ponche de cualquier hotel: PunchMark -> TimesheetDay -> Timesheet ->
  // Requisition -> Hotel (el mismo cruce de esquemas que ya usa Auditorías).
  async punches(params: {
    page: number
    limit: number
    hotelId?: string | undefined
  }): Promise<{ rows: PunchRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit

    const rows = await this.prisma.$queryRaw<PunchRow[]>`
      SELECT pm.id,
             pm.type,
             pm.server_at AS "serverAt",
             pm.inside_geofence AS "insideGeofence",
             pm.is_manual AS "isManual",
             w.id AS "workerId",
             w.full_name AS "workerFullName",
             h.id AS "hotelId",
             h.name AS "hotelName",
             lower(se.shift_range) AS "scheduledStart",
             CASE
               WHEN pm.type = 'CLOCK_IN' AND se.shift_range IS NOT NULL
                 THEN ROUND(EXTRACT(EPOCH FROM (pm.server_at - lower(se.shift_range))) / 60)::int
               ELSE NULL
             END AS "lateMinutes"
        FROM operations.punch_mark pm
        JOIN operations.timesheet_day td ON td.id = pm.timesheet_day_id
        JOIN operations.timesheet t      ON t.id = td.timesheet_id
        JOIN demand.requisition r        ON r.id = t.requisition_id
        JOIN commercial.hotel h          ON h.id = r.hotel_id
        JOIN personal.worker w           ON w.id = t.worker_id
        LEFT JOIN LATERAL (
          SELECT shift_range
            FROM operations.schedule_entry se
           WHERE se.worker_id = t.worker_id AND se.work_date = td.work_date
           ORDER BY lower(se.shift_range)
           LIMIT 1
        ) se ON true
       WHERE ${params.hotelId ?? null}::uuid IS NULL OR h.id = ${params.hotelId ?? null}::uuid
       ORDER BY pm.server_at DESC
       LIMIT ${params.limit} OFFSET ${offset}`

    const totalRows = await this.prisma.$queryRaw<Array<{ total: number }>>`
      SELECT COUNT(*)::int AS total
        FROM operations.punch_mark pm
        JOIN operations.timesheet_day td ON td.id = pm.timesheet_day_id
        JOIN operations.timesheet t      ON t.id = td.timesheet_id
        JOIN demand.requisition r        ON r.id = t.requisition_id
        JOIN commercial.hotel h          ON h.id = r.hotel_id
       WHERE ${params.hotelId ?? null}::uuid IS NULL OR h.id = ${params.hotelId ?? null}::uuid`

    return { rows, total: totalRows[0]?.total ?? 0 }
  }

  // Reclutamiento: el Pool por estado del Semáforo del Colaborador.
  async recruitmentWorkerCounts(): Promise<StateSnapshotRow[]> {
    return this.prisma.$queryRaw<StateSnapshotRow[]>`
      SELECT sls.code, sls.name, COUNT(*)::int AS count
        FROM personal.worker w
        JOIN catalogs.status_light_state sls ON sls.id = w.status_light_state_id
       GROUP BY sls.code, sls.name, sls.display_order
       ORDER BY sls.display_order`
  }

  // Hotel: requisiciones por estado + semanas de timesheet sin aprobar.
  async hotelRequisitionCounts(): Promise<StateSnapshotRow[]> {
    return this.prisma.$queryRaw<StateSnapshotRow[]>`
      SELECT sls.code, sls.name, COUNT(*)::int AS count
        FROM demand.requisition r
        JOIN catalogs.status_light_state sls ON sls.id = r.status_light_state_id
       GROUP BY sls.code, sls.name, sls.display_order
       ORDER BY sls.display_order`
  }

  async hotelPendingApprovalWeeks(): Promise<number> {
    return this.prisma.timesheet.count({ where: { status: 'PENDING_APPROVAL' } })
  }

  // Ventas: prospectos por estado del Semáforo Onboarding.
  async salesProspectCounts(): Promise<StateSnapshotRow[]> {
    return this.prisma.$queryRaw<StateSnapshotRow[]>`
      SELECT sls.code, sls.name, COUNT(*)::int AS count
        FROM commercial.prospect p
        JOIN catalogs.status_light_state sls ON sls.id = p.onboarding_state_id
       GROUP BY sls.code, sls.name, sls.display_order
       ORDER BY sls.display_order`
  }

  // Inspección: tarjetas de accidente por estado (propuesta sin semáforo,
  // 2026-08-20 — los 4 valores de `work_accident.status`, texto libre).
  async inspectionAccidentCounts(): Promise<Array<{ status: string; count: number }>> {
    return this.prisma.$queryRaw<Array<{ status: string; count: number }>>`
      SELECT status, COUNT(*)::int AS count
        FROM supervision.work_accident
       GROUP BY status`
  }

  // Contabilidad: consolidados por estado del Flujo de Nómina.
  async accountingConsolidationCounts(): Promise<Array<{ status: string; count: number }>> {
    return this.prisma.$queryRaw<Array<{ status: string; count: number }>>`
      SELECT status, COUNT(*)::int AS count
        FROM settlement.consolidation
       GROUP BY status`
  }
}
