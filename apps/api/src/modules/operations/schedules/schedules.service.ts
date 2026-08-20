import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import type { CreateEntryDto } from './dto/create-entry.dto.js'
import type { CreateScheduleDto } from './dto/create-schedule.dto.js'
import { EntryRow, ScheduleRow, SchedulesRepository } from './schedules.repository.js'

const WEEK_DAYS = 7
const MAX_SHIFT_HOURS = 16

export interface ScheduleEntity {
  id: string
  hotel: { id: string; name: string; timeZone: string }
  weekStart: string
  weekEnd: string
  entryCount: number
  createdAt: string
}

export interface EntryEntity {
  id: string
  workDate: string
  startsAt: string
  endsAt: string
  minutes: number
  worker: { id: string; fullName: string }
  assignmentId: string
}

@Injectable()
export class SchedulesService {
  constructor(private readonly repo: SchedulesRepository) {}

  async list(user: AuthenticatedUser): Promise<ScheduleEntity[]> {
    return (await this.repo.listAll(user.hotelId)).map(toEntity)
  }

  async get(id: string): Promise<ScheduleEntity> {
    return toEntity(await this.schedule(id))
  }

  async create(dto: CreateScheduleDto, user: AuthenticatedUser): Promise<ScheduleEntity> {
    if (user.hotelId && user.hotelId !== dto.hotelId) {
      throw new ConflictException({
        code: 'HOTEL_OUT_OF_SCOPE',
        message: 'Solo puedes armar el Schedule de tu hotel',
      })
    }

    if (!(await this.repo.hotel(dto.hotelId))) {
      throw new NotFoundException({ code: 'HOTEL_NOT_FOUND', message: 'El hotel no existe' })
    }

    if (dto.weekStart.getUTCDay() !== 1) {
      throw new UnprocessableEntityException({
        code: 'WEEK_MUST_START_MONDAY',
        message: 'La semana del Schedule empieza en lunes',
      })
    }

    if (await this.repo.byWeek(dto.hotelId, dto.weekStart)) {
      throw new ConflictException({
        code: 'SCHEDULE_EXISTS',
        message: 'Este hotel ya tiene Schedule para esa semana',
      })
    }

    const weekEnd = new Date(dto.weekStart)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + WEEK_DAYS - 1)

    return toEntity(
      await this.repo.create({
        hotelId: dto.hotelId,
        weekStart: dto.weekStart,
        weekEnd,
        userId: user.id,
        roleCode: user.roleCode,
      }),
    )
  }

  async entries(scheduleId: string): Promise<EntryEntity[]> {
    await this.schedule(scheduleId)

    return (await this.repo.entries(scheduleId)).map(toEntry)
  }

  async addEntry(
    scheduleId: string,
    dto: CreateEntryDto,
    user: AuthenticatedUser,
  ): Promise<EntryEntity> {
    const schedule = await this.schedule(scheduleId)
    const assignment = await this.repo.assignment(dto.assignmentId)

    if (!assignment) {
      throw new NotFoundException({
        code: 'ASSIGNMENT_NOT_FOUND',
        message: 'La asignación no existe',
      })
    }

    if (assignment.status !== 'ACTIVE') {
      throw new UnprocessableEntityException({
        code: 'ASSIGNMENT_NOT_ACTIVE',
        message: `No se planea sobre una asignación en ${assignment.status}`,
      })
    }

    if (assignment.hotelId !== schedule.hotel.id) {
      throw new UnprocessableEntityException({
        code: 'ASSIGNMENT_OTHER_HOTEL',
        message: 'Esa asignación es de otro hotel',
      })
    }

    this.assertInsideWeek(dto.workDate, schedule)

    const { startsAt, endsAt } = shiftBounds(dto)

    if (endsAt.getTime() - startsAt.getTime() > MAX_SHIFT_HOURS * 3_600_000) {
      throw new UnprocessableEntityException({
        code: 'SHIFT_TOO_LONG',
        message: `Un turno no puede pasar de ${MAX_SHIFT_HOURS} horas`,
      })
    }

    const id = await this.insert({
      scheduleId,
      assignmentId: dto.assignmentId,
      workerId: assignment.workerId,
      workDate: dto.workDate,
      startsAt,
      endsAt,
      workerName: assignment.workerName,
      user,
    })

    const created = (await this.repo.entries(scheduleId)).find((e) => e.id === id)

    if (!created) {
      throw new ConflictException({
        code: 'ENTRY_NOT_FOUND',
        message: 'El turno no quedó registrado',
      })
    }

    return toEntry(created)
  }

  async removeEntry(scheduleId: string, entryId: string, user: AuthenticatedUser): Promise<void> {
    await this.schedule(scheduleId)

    const entry = await this.repo.entryById(entryId)

    if (!entry || entry.scheduleId !== scheduleId) {
      throw new NotFoundException({
        code: 'ENTRY_NOT_FOUND',
        message: 'El turno no existe en este Schedule',
      })
    }

    await this.repo.removeEntry({
      entryId,
      scheduleId,
      userId: user.id,
      roleCode: user.roleCode,
    })
  }

  private async insert(params: {
    scheduleId: string
    assignmentId: string
    workerId: string
    workDate: Date
    startsAt: Date
    endsAt: Date
    workerName: string
    user: AuthenticatedUser
  }): Promise<string> {
    try {
      return await this.repo.addEntry({
        scheduleId: params.scheduleId,
        assignmentId: params.assignmentId,
        workerId: params.workerId,
        workDate: params.workDate,
        startsAt: params.startsAt,
        endsAt: params.endsAt,
        userId: params.user.id,
        roleCode: params.user.roleCode,
      })
    } catch (error) {
      if (isOverlap(error)) {
        throw new ConflictException({
          code: 'SHIFT_OVERLAP',
          message: `${params.workerName} ya tiene un turno que se encima con ese horario`,
        })
      }

      throw error
    }
  }

  private assertInsideWeek(workDate: Date, schedule: ScheduleRow): void {
    const day = workDate.toISOString().slice(0, 10)
    const start = schedule.weekStart.toISOString().slice(0, 10)
    const end = schedule.weekEnd.toISOString().slice(0, 10)

    if (day < start || day > end) {
      throw new UnprocessableEntityException({
        code: 'DATE_OUTSIDE_WEEK',
        message: `El Schedule cubre del ${start} al ${end}`,
      })
    }
  }

  private async schedule(id: string): Promise<ScheduleRow> {
    const row = await this.repo.byId(id)

    if (!row) {
      throw new NotFoundException({
        code: 'SCHEDULE_NOT_FOUND',
        message: 'El Schedule no existe',
      })
    }

    return row
  }
}

function shiftBounds(dto: CreateEntryDto): { startsAt: Date; endsAt: Date } {
  const day = dto.workDate.toISOString().slice(0, 10)
  const startsAt = new Date(`${day}T${dto.startTime}:00Z`)
  const endsAt = new Date(`${day}T${dto.endTime}:00Z`)

  if (endsAt <= startsAt) {
    endsAt.setUTCDate(endsAt.getUTCDate() + 1)
  }

  return { startsAt, endsAt }
}

function isOverlap(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)

  return message.includes('no_shift_overlap') || message.includes('23P01')
}

function toEntity(row: ScheduleRow): ScheduleEntity {
  return {
    id: row.id,
    hotel: row.hotel,
    weekStart: row.weekStart.toISOString().slice(0, 10),
    weekEnd: row.weekEnd.toISOString().slice(0, 10),
    entryCount: row._count.entries,
    createdAt: row.createdAt.toISOString(),
  }
}

function toEntry(row: EntryRow): EntryEntity {
  const startsAt = new Date(row.startsAt)
  const endsAt = new Date(row.endsAt)

  return {
    id: row.id,
    workDate: new Date(row.workDate).toISOString().slice(0, 10),
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    minutes: Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000),
    worker: row.worker,
    assignmentId: row.assignmentId,
  }
}
