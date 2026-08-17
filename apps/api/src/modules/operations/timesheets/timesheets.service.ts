import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import type { CreateManualPunchDto, CreatePunchDto } from './dto/create-punch.dto.js'
import { LUNCH_TYPES } from './dto/create-punch.dto.js'
import {
  AssignmentContext,
  DayRow,
  PunchRow,
  TimesheetRow,
  TimesheetsRepository,
} from './timesheets.repository.js'

const OPEN = 'OPEN'
const PENDING = 'PENDING_APPROVAL'
const APPROVED = 'APPROVED'

const CLOCK_IN = 'CLOCK_IN'
const CLOCK_OUT = 'CLOCK_OUT'

const GENERAL_MANAGER = 'ROL-H-03'

export interface PunchEntity {
  id: string
  type: string
  serverAt: string
  deviceAt: string | null
  insideGeofence: boolean | null
  isManual: boolean
  manualReason: string | null
}

export interface PunchResult {
  punch: PunchEntity
  dayId: string
  grossMinutes: number
  hasAnomaly: boolean
}

export interface TimesheetEntity {
  id: string
  worker: { id: string; fullName: string }
  requisitionId: string
  weekStart: string
  weekEnd: string
  status: string
  approvedAt: string | null
  days?: DayEntity[]
  totals?: { grossMinutes: number; netMinutes: number; overtimeMinutes: number }
}

export interface DayEntity {
  id: string
  workDate: string
  grossMinutes: number
  netMinutes: number
  lunchDeductionMinutes: number
  actualLunchMinutes: number | null
  overtimeMinutes: number
  isAbsence: boolean
  hasAnomaly: boolean
  reviewNote: string | null
  punches: PunchEntity[]
}

@Injectable()
export class TimesheetsService {
  constructor(private readonly repo: TimesheetsRepository) {}

  async punch(dto: CreatePunchDto, user: AuthenticatedUser): Promise<PunchResult> {
    const assignment = await this.assignment(dto.assignmentId)

    if (!LUNCH_TYPES.includes(dto.type as (typeof LUNCH_TYPES)[number]) && !dto.photoPath) {
      throw new UnprocessableEntityException({
        code: 'PHOTO_REQUIRED',
        message: `La marca ${dto.type} necesita foto`,
      })
    }

    const now = new Date()
    const { dayId, status } = await this.openDay(assignment, now)

    this.assertEditable(status)

    if (await this.repo.punchExists(dayId, dto.type)) {
      throw new ConflictException({
        code: 'PUNCH_ALREADY_REGISTERED',
        message: `Ya hay una marca ${dto.type} en este día`,
      })
    }

    const inside = assignment.hasCoordinates
      ? await this.repo.insideGeofence(assignment.hotelId, dto.latitude, dto.longitude)
      : null

    if (inside === false) {
      throw new UnprocessableEntityException({
        code: 'OUTSIDE_GEOFENCE',
        message: 'Estás fuera del hotel: pide al Supervisor un ponche manual',
      })
    }

    const id = await this.repo.addPunch({
      dayId,
      type: dto.type,
      latitude: dto.latitude,
      longitude: dto.longitude,
      insideGeofence: inside,
      photoPath: dto.photoPath ?? null,
      deviceAt: dto.deviceAt ?? null,
      userId: user.id,
      roleCode: user.roleCode,
    })

    return this.afterPunch(dayId, id)
  }

  async manualPunch(dto: CreateManualPunchDto, user: AuthenticatedUser): Promise<PunchResult> {
    const assignment = await this.assignment(dto.assignmentId)
    const { dayId, status } = await this.openDay(assignment, dto.workDate)

    this.assertEditable(status)

    if (await this.repo.punchExists(dayId, dto.type)) {
      throw new ConflictException({
        code: 'PUNCH_ALREADY_REGISTERED',
        message: `Ya hay una marca ${dto.type} en este día`,
      })
    }

    const id = await this.repo.addManualPunch({
      dayId,
      type: dto.type,
      occurredAt: dto.occurredAt,
      reason: dto.reason,
      userId: user.id,
      roleCode: user.roleCode,
    })

    return this.afterPunch(dayId, id)
  }

  async list(user: AuthenticatedUser, status?: string): Promise<TimesheetEntity[]> {
    const rows = await this.repo.listAll({
      hotelId: user.hotelId,
      departmentId: user.roleCode === GENERAL_MANAGER ? null : user.departmentId,
      status,
    })

    return rows.map(toTimesheet)
  }

  async get(id: string): Promise<TimesheetEntity> {
    const sheet = await this.timesheet(id)
    const days = await this.repo.days(id)

    const detailed = await Promise.all(
      days.map(async (d) => toDay(d, await this.repo.punches(d.id))),
    )

    return {
      ...toTimesheet(sheet),
      days: detailed,
      totals: {
        grossMinutes: days.reduce((t, d) => t + d.grossMinutes, 0),
        netMinutes: days.reduce((t, d) => t + d.netMinutes, 0),
        overtimeMinutes: days.reduce((t, d) => t + d.overtimeMinutes, 0),
      },
    }
  }

  async submit(id: string, user: AuthenticatedUser): Promise<TimesheetEntity> {
    const sheet = await this.timesheet(id)

    if (sheet.status !== OPEN) {
      throw new ConflictException({
        code: 'TIMESHEET_NOT_OPEN',
        message: `Este Timesheet está en ${sheet.status}`,
      })
    }

    const pending = (await this.repo.days(id)).filter((d) => d.hasAnomaly)

    if (pending.length > 0) {
      throw new UnprocessableEntityException({
        code: 'ANOMALIES_PENDING',
        message: `Quedan ${pending.length} días con anomalía sin resolver`,
        details: pending.map((d) => ({
          field: 'workDate',
          value: d.workDate.toISOString().slice(0, 10),
        })),
      })
    }

    await this.repo.setStatus({
      id,
      status: PENDING,
      approvedBy: null,
      userId: user.id,
      roleCode: user.roleCode,
      event: 'TIMESHEET_SUBMITTED',
    })

    return this.get(id)
  }

  async approve(id: string, user: AuthenticatedUser): Promise<TimesheetEntity> {
    const sheet = await this.timesheet(id)

    if (sheet.status !== PENDING) {
      throw new ConflictException({
        code: 'TIMESHEET_NOT_PENDING',
        message: `Solo se aprueba un Timesheet en revisión, y este está en ${sheet.status}`,
      })
    }

    if (user.departmentId && sheet.departmentId !== user.departmentId) {
      throw new ForbiddenException({
        code: 'DEPARTMENT_OUT_OF_SCOPE',
        message: 'Solo apruebas las horas de tu departamento',
      })
    }

    await this.repo.setStatus({
      id,
      status: APPROVED,
      approvedBy: user.id,
      userId: user.id,
      roleCode: user.roleCode,
      event: 'HOURS_APPROVED',
    })

    return this.get(id)
  }

  async reviewDay(dayId: string, note: string, user: AuthenticatedUser): Promise<DayEntity> {
    const day = await this.repo.dayById(dayId)

    if (!day) {
      throw new NotFoundException({ code: 'DAY_NOT_FOUND', message: 'El día no existe' })
    }

    this.assertEditable(day.status)

    await this.repo.reviewDay({ dayId, note, userId: user.id, roleCode: user.roleCode })

    const rows = await this.repo.days(day.timesheetId)
    const row = rows.find((d) => d.id === dayId)

    if (!row) {
      throw new NotFoundException({ code: 'DAY_NOT_FOUND', message: 'El día no existe' })
    }

    return toDay(row, await this.repo.punches(dayId))
  }

  private async afterPunch(dayId: string, punchId: string): Promise<PunchResult> {
    const punches = await this.repo.punches(dayId)
    const { grossMinutes, hasAnomaly } = summarize(punches)

    await this.repo.recalcDay(dayId, grossMinutes, hasAnomaly)

    const punch = punches.find((p) => p.id === punchId)

    if (!punch) {
      throw new ConflictException({
        code: 'PUNCH_NOT_FOUND',
        message: 'La marca no quedó registrada',
      })
    }

    return { punch: toPunch(punch), dayId, grossMinutes, hasAnomaly }
  }

  private assertEditable(status: string): void {
    if (status === APPROVED) {
      throw new ConflictException({
        code: 'TIMESHEET_APPROVED',
        message: 'Las horas ya están aprobadas y no se modifican',
      })
    }
  }

  private async openDay(
    assignment: AssignmentContext,
    when: Date,
  ): Promise<{ dayId: string; status: string }> {
    const schedule = await this.repo.scheduleOf(assignment.hotelId, when)

    if (!schedule) {
      throw new UnprocessableEntityException({
        code: 'SCHEDULE_MISSING',
        message: 'El hotel no tiene Schedule para esa semana',
      })
    }

    const { dayId, status } = await this.repo.ensureDay({
      scheduleId: schedule.id,
      workerId: assignment.workerId,
      requisitionId: assignment.requisitionId,
      weekStart: schedule.weekStart,
      weekEnd: schedule.weekEnd,
      workDate: new Date(`${when.toISOString().slice(0, 10)}T00:00:00Z`),
    })

    return { dayId, status }
  }

  private async assignment(id: string): Promise<AssignmentContext> {
    const row = await this.repo.assignment(id)

    if (!row) {
      throw new NotFoundException({
        code: 'ASSIGNMENT_NOT_FOUND',
        message: 'La asignación no existe',
      })
    }

    if (row.status !== 'ACTIVE') {
      throw new UnprocessableEntityException({
        code: 'ASSIGNMENT_NOT_ACTIVE',
        message: `No se poncha sobre una asignación en ${row.status}`,
      })
    }

    return row
  }

  private async timesheet(id: string): Promise<TimesheetRow & { departmentId: string | null }> {
    const row = await this.repo.timesheet(id)

    if (!row) {
      throw new NotFoundException({
        code: 'TIMESHEET_NOT_FOUND',
        message: 'El Timesheet no existe',
      })
    }

    return row
  }
}

export function summarize(punches: PunchRow[]): { grossMinutes: number; hasAnomaly: boolean } {
  const at = (type: string): Date | undefined => punches.find((p) => p.type === type)?.serverAt

  const start = at(CLOCK_IN)
  const end = at(CLOCK_OUT)

  if (!start || !end) {
    return { grossMinutes: 0, hasAnomaly: true }
  }

  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000)

  return { grossMinutes: Math.max(0, minutes), hasAnomaly: minutes <= 0 }
}

function toPunch(row: PunchRow): PunchEntity {
  return {
    id: row.id,
    type: row.type,
    serverAt: row.serverAt.toISOString(),
    deviceAt: row.deviceAt?.toISOString() ?? null,
    insideGeofence: row.insideGeofence,
    isManual: row.isManual,
    manualReason: row.manualReason,
  }
}

function toDay(row: DayRow, punches: PunchRow[]): DayEntity {
  return {
    id: row.id,
    workDate: new Date(row.workDate).toISOString().slice(0, 10),
    grossMinutes: row.grossMinutes,
    netMinutes: row.netMinutes,
    lunchDeductionMinutes: row.lunchDeductionMinutes,
    actualLunchMinutes: row.actualLunchMinutes,
    overtimeMinutes: row.overtimeMinutes,
    isAbsence: row.isAbsence,
    hasAnomaly: row.hasAnomaly,
    reviewNote: row.reviewNote,
    punches: punches.map(toPunch),
  }
}

function toTimesheet(row: TimesheetRow): TimesheetEntity {
  return {
    id: row.id,
    worker: row.worker,
    requisitionId: row.requisitionId,
    weekStart: new Date(row.weekStart).toISOString().slice(0, 10),
    weekEnd: new Date(row.weekEnd).toISOString().slice(0, 10),
    status: row.status,
    approvedAt: row.approvedAt ? new Date(row.approvedAt).toISOString() : null,
  }
}
