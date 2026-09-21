import { Injectable } from '@nestjs/common'

import {
  ObservabilityRepository,
  PunchRow,
  SpanSummaryRow,
  StateDurationRow,
  StateSnapshotRow,
  TotalDurationRow,
} from './observability.repository.js'

export interface StatusLightSummary {
  code: string
  label: string
  /** Tiene historial append-only: la duración es real, no aproximada. */
  hasHistory: boolean
  /** `null` cuando el semáforo no tiene ni historial ni columna de estado — no hay nada que mostrar. */
  states: StateDurationRow[] | StateSnapshotRow[] | null
  /** Solo para los dos semáforos del Timesheet que no son del sistema genérico: un único tramo aproximado. */
  span?: SpanSummaryRow
  /**
   * Solo para los 3 con historial: el promedio de vida completa (de la
   * primera transición a ahora), NO la suma de los promedios por estado —
   * Hugo (2026-09-21): "en total por todas". Se calcula aparte porque sumar
   * los promedios por estado mentiría sobre quien pasó por menos estados.
   */
  total?: TotalDurationRow
  note: string
}

export interface DepartmentMetric {
  code: string
  name: string
  implemented: boolean
  counts: Array<{ label: string; count: number }>
  note: string
}

@Injectable()
export class ObservabilityService {
  constructor(private readonly repo: ObservabilityRepository) {}

  // Reporta lo que cada semáforo honestamente puede mostrar. No inventa
  // duración donde solo hay una foto del estado actual (Roles del Sistema.md,
  // 2026-09-21: "sin SLA ni umbral inventado").
  async statusLightDurations(): Promise<StatusLightSummary[]> {
    const [
      worker,
      workerTotal,
      requisition,
      requisitionTotal,
      onboarding,
      onboardingTotal,
      coverage,
      urgency,
      dayReview,
      weekApproval,
    ] = await Promise.all([
      this.repo.workerStateDurations(),
      this.repo.workerTotalDuration(),
      this.repo.requisitionStateDurations(),
      this.repo.requisitionTotalDuration(),
      this.repo.onboardingStateDurations(),
      this.repo.onboardingTotalDuration(),
      this.repo.positionCoverageSnapshot(),
      this.repo.urgencySnapshot(),
      this.repo.dayReviewSpan(),
      this.repo.weekApprovalSpan(),
    ])

    return [
      {
        code: 'WORKER',
        label: 'Semáforo del Colaborador',
        hasHistory: true,
        states: worker,
        total: workerTotal,
        note: 'Duración real por estado, calculada del historial de transiciones.',
      },
      {
        code: 'REQUISITION',
        label: 'Semáforo de Requisición',
        hasHistory: true,
        states: requisition,
        total: requisitionTotal,
        note: 'Duración real por estado, calculada del historial de transiciones.',
      },
      {
        code: 'ONBOARDING',
        label: 'Semáforo Onboarding',
        hasHistory: true,
        states: onboarding,
        total: onboardingTotal,
        note: 'Duración real por estado, calculada del historial de transiciones.',
      },
      {
        code: 'POSITION_COVERAGE',
        label: 'Semáforo de Posiciones de la Requisición',
        hasHistory: false,
        states: coverage,
        note: 'Solo el estado actual: este semáforo no guarda historial, así que no se puede calcular cuánto tardó.',
      },
      {
        code: 'URGENCY',
        label: 'Semáforo de Urgencia de Requisición',
        hasHistory: false,
        states: urgency,
        note: 'Solo el estado actual: este semáforo no guarda historial, así que no se puede calcular cuánto tardó.',
      },
      {
        code: 'DAY_REVIEW',
        label: 'Semáforo de Revisión del Día',
        hasHistory: false,
        states: null,
        span: dayReview,
        note: 'No es parte del sistema de semáforos: se aproxima con la fecha de creación y la de revisión del día, sin los estados intermedios.',
      },
      {
        code: 'WEEK_APPROVAL',
        label: 'Semáforo de Aprobación de la Semana',
        hasHistory: false,
        states: null,
        span: weekApproval,
        note: 'No es parte del sistema de semáforos: se aproxima con la fecha de creación y la de aprobación de la semana, sin los estados intermedios.',
      },
      {
        code: 'QUALITY',
        label: 'Indicador de Calidad',
        hasHistory: false,
        states: null,
        note: 'No implementado en el sistema: no hay una sola tabla o columna que lo lea ni lo escriba todavía.',
      },
      {
        code: 'TIMESHEET_COMPLIANCE',
        label: 'Indicador de Cumplimiento del Timesheet',
        hasHistory: false,
        states: null,
        note: 'No implementado en el sistema: el estado está sembrado en el catálogo pero ninguna tabla lo referencia todavía.',
      },
    ]
  }

  async punches(params: { page: number; limit: number; hotelId?: string | undefined }): Promise<{
    rows: PunchRow[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    const { rows, total } = await this.repo.punches(params)
    return {
      rows,
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    }
  }

  async departmentMetrics(): Promise<DepartmentMetric[]> {
    const [worker, requisition, pendingWeeks, prospect, accidents, consolidations] =
      await Promise.all([
        this.repo.recruitmentWorkerCounts(),
        this.repo.hotelRequisitionCounts(),
        this.repo.hotelPendingApprovalWeeks(),
        this.repo.salesProspectCounts(),
        this.repo.inspectionAccidentCounts(),
        this.repo.accountingConsolidationCounts(),
      ])

    return [
      {
        code: 'RECRUITMENT',
        name: 'Reclutamiento',
        implemented: true,
        counts: worker.map((s) => ({ label: s.name, count: s.count })),
        note: 'Colaboradores del Pool, por estado del Semáforo del Colaborador.',
      },
      {
        code: 'HOTEL',
        name: 'Hotel',
        implemented: true,
        counts: [
          ...requisition.map((s) => ({ label: s.name, count: s.count })),
          { label: 'Semanas de Timesheet sin aprobar', count: pendingWeeks },
        ],
        note: 'Requisiciones por estado del Semáforo de Requisición, más semanas de timesheet pendientes de aprobación.',
      },
      {
        code: 'SALES',
        name: 'Ventas',
        implemented: true,
        counts: prospect.map((s) => ({ label: s.name, count: s.count })),
        note: 'Prospectos por estado del Semáforo Onboarding.',
      },
      {
        code: 'INSPECTION',
        name: 'Inspección',
        implemented: true,
        counts: accidents.map((s) => ({ label: s.status, count: s.count })),
        note: 'Tarjetas de accidente por estado (propuesta, sin semáforo formal — 2026-08-20).',
      },
      {
        code: 'ACCOUNTING',
        name: 'Contabilidad',
        implemented: true,
        counts: consolidations.map((s) => ({ label: s.status, count: s.count })),
        note: 'Consolidados de nómina por estado del Flujo de Nómina.',
      },
      {
        code: 'QA',
        name: 'QA',
        implemented: false,
        counts: [],
        note: 'No implementado en el sistema todavía: no existe módulo ni tabla de QA en el código.',
      },
      {
        code: 'CUSTOMER_SERVICE',
        name: 'Customer Service',
        implemented: false,
        counts: [],
        note: 'No implementado en el sistema todavía: no existe módulo ni tabla de Customer Service en el código.',
      },
    ]
  }
}
