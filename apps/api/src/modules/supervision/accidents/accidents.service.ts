import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { PrismaService } from '../../../infra/prisma/index.js'

import { AccidentRow, AccidentsRepository } from './accidents.repository.js'
import type {
  CaptureOnSiteDto,
  CloseAccidentDto,
  MedicalFollowUpDto,
  QueryAccidentsDto,
  ReportAccidentDto,
} from './dto/accident.dto.js'

const ALPHABET = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789'
const ACCIDENTED = 'GRAY'
const AVAILABLE = 'STRONG_GREEN'
const CLOSED = 'CLOSED'

export interface AccidentEntity {
  id: string
  number: string
  status: string
  occurredAt: string
  hotel: { id: string; name: string }
  worker: { id: string; fullName: string }
  reportedBy: { id: string; fullName: string }
  inspector: { id: string; fullName: string } | null
  onSite: {
    siteLocation: string | null
    circumstances: string | null
    witnesses: string | null
    immediateCare: string | null
    capturedBy: { id: string; fullName: string } | null
    capturedAt: string | null
  }
  medical: {
    isTransferred: boolean | null
    medicalCenter: string | null
    diagnosis: string | null
    disabilityDays: number | null
    medicalNotes: string | null
  }
  closure: {
    medicalDischargeDate: string | null
    closedBy: { id: string; fullName: string } | null
    closedAt: string | null
  }
  createdAt: string
}

@Injectable()
export class AccidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: AccidentsRepository,
  ) {}

  // Escenario A. El colaborador reporta desde la app: la tarjeta nace solo con
  // la cabecera y él no manda su propio id, sale de su cuenta.
  async reportOwn(
    dto: { hotelId: string; occurredAt: Date },
    user: AuthenticatedUser,
  ): Promise<AccidentEntity> {
    const worker = await this.repo.workerOfUser(user.id)

    if (!worker) {
      throw new NotFoundException({
        code: 'WORKER_NOT_LINKED',
        message: 'Tu cuenta no está ligada a un colaborador',
      })
    }

    return this.create({ ...dto, workerId: worker.id }, user)
  }

  // Escenario B. El Supervisor reporta, y puede traer ya lo presencial: en ese
  // caso la tarjeta salta a ON_SITE_CAPTURED sin un paso intermedio.
  async report(dto: ReportAccidentDto, user: AuthenticatedUser): Promise<AccidentEntity> {
    return this.create(dto, user)
  }

  async list(query: QueryAccidentsDto): Promise<AccidentEntity[]> {
    const where: Prisma.WorkAccidentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.workerId ? { workerId: query.workerId } : {}),
      ...(query.hotelId ? { hotelId: query.hotelId } : {}),
      ...(query.openOnly ? { status: { not: CLOSED } } : {}),
    }

    return (await this.repo.findMany(where)).map(toEntity)
  }

  async get(id: string): Promise<AccidentEntity> {
    return toEntity(await this.accident(id))
  }

  async captureOnSite(
    id: string,
    dto: CaptureOnSiteDto,
    user: AuthenticatedUser,
  ): Promise<AccidentEntity> {
    const row = await this.accident(id)

    this.assertOpen(row)

    return toEntity(
      await this.repo.update(id, {
        ...defined(dto),
        onSiteCapturedBy: user.id,
        onSiteCapturedAt: new Date(),
        // Solo avanza si sigue en el primer paso: recapturar no retrocede una
        // tarjeta que ya está en seguimiento médico.
        ...(row.status === 'REPORTED' ? { status: 'ON_SITE_CAPTURED' } : {}),
        updatedAt: new Date(),
        updatedBy: user.id,
      }),
    )
  }

  async medicalFollowUp(
    id: string,
    dto: MedicalFollowUpDto,
    user: AuthenticatedUser,
  ): Promise<AccidentEntity> {
    const row = await this.accident(id)

    this.assertOpen(row)
    this.assertOwnCard(row, user)

    // El centro médico solo existe si hubo traslado, y quien lo impone es el
    // CHECK. Sin traducirlo, la incoherencia sale como error interno.
    try {
      return toEntity(
        await this.repo.update(id, {
          ...defined(dto),
          status: 'MEDICAL_FOLLOW_UP',
          updatedAt: new Date(),
          updatedBy: user.id,
        }),
      )
    } catch (error) {
      if (isCheckViolation(error, 'ck_work_accident_transfer_coherent')) {
        throw new UnprocessableEntityException({
          code: 'TRANSFER_INCOHERENT',
          message: 'Solo se registra centro médico si hubo traslado',
        })
      }

      throw error
    }
  }

  // Cerrar la tarjeta devuelve al colaborador a Verde fuerte. Las dos cosas van
  // en la misma transacción: una tarjeta cerrada con el colaborador en GRIS es
  // alguien fuera de operación sin motivo vigente.
  async close(id: string, dto: CloseAccidentDto, user: AuthenticatedUser): Promise<AccidentEntity> {
    const row = await this.accident(id)

    this.assertOpen(row)
    this.assertOwnCard(row, user)

    const worker = await this.repo.worker(row.worker.id)

    if (!worker) {
      throw new NotFoundException({ code: 'WORKER_NOT_FOUND', message: 'El colaborador no existe' })
    }

    const gray = await this.state(ACCIDENTED)
    const available = await this.state(AVAILABLE)

    if (!(await this.repo.transitionAllowed(gray.id, available.id, user.roleCode))) {
      throw new ForbiddenException({
        code: 'TRANSITION_FORBIDDEN',
        message: 'Tu rol no puede devolver al colaborador a Verde fuerte',
      })
    }

    const now = new Date()

    await this.prisma.$transaction(async (tx) => {
      await tx.workAccident.update({
        where: { id },
        data: {
          status: CLOSED,
          medicalDischargeDate: dto.medicalDischargeDate,
          closedBy: user.id,
          closedAt: now,
          updatedAt: now,
          updatedBy: user.id,
        },
      })

      // Solo si sigue en GRIS: si alguien ya lo movió, la tarjeta se cierra sin
      // pisar el estado que tenga hoy.
      if (worker.statusLightStateId === gray.id) {
        await tx.worker.update({
          where: { id: worker.id },
          data: { statusLightStateId: available.id, updatedAt: now },
        })

        await tx.workerStateHistory.create({
          data: {
            id: uuidv7(),
            workerId: worker.id,
            fromStateId: gray.id,
            toStateId: available.id,
            statusLightCode: 'WORKER',
            userId: user.id,
          },
        })
      }

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'supervision.work_accident',
          entityId: id,
          eventType: 'ACCIDENT_CLOSED',
          actorUserId: user.id,
          actorRole: user.roleCode,
          payload: {
            number: row.number,
            hotelId: row.hotel.id,
            workerId: row.worker.id,
            status: CLOSED,
            medicalDischargeDate: dto.medicalDischargeDate.toISOString().slice(0, 10),
          },
        },
      })
    })

    return this.get(id)
  }

  private async create(
    dto: {
      hotelId: string
      workerId: string
      occurredAt: Date
      siteLocation?: string | undefined
      circumstances?: string | undefined
      witnesses?: string | undefined
      immediateCare?: string | undefined
    },
    user: AuthenticatedUser,
  ): Promise<AccidentEntity> {
    const worker = await this.repo.worker(dto.workerId)

    if (!worker) {
      throw new NotFoundException({ code: 'WORKER_NOT_FOUND', message: 'El colaborador no existe' })
    }

    const hotel = await this.repo.hotelZone(dto.hotelId)

    if (!hotel) {
      throw new NotFoundException({ code: 'HOTEL_NOT_FOUND', message: 'El hotel no existe' })
    }

    const gray = await this.state(ACCIDENTED)

    if (worker.statusLightStateId === gray.id) {
      throw new ConflictException({
        code: 'WORKER_ALREADY_ACCIDENTED',
        message: 'Este colaborador ya está en GRIS por una tarjeta abierta',
      })
    }

    const id = uuidv7()
    const number = await this.nextNumber()
    const now = new Date()
    const inspector = await this.repo.inspectorOfZone(hotel.zoneId)
    const hasOnSite = Boolean(
      dto.siteLocation ?? dto.circumstances ?? dto.witnesses ?? dto.immediateCare,
    )

    await this.prisma.$transaction(async (tx) => {
      await tx.workAccident.create({
        data: {
          id,
          number,
          hotelId: dto.hotelId,
          workerId: dto.workerId,
          reportedByUserId: user.id,
          inspectorId: inspector?.id ?? null,
          occurredAt: dto.occurredAt,
          status: hasOnSite ? 'ON_SITE_CAPTURED' : 'REPORTED',
          siteLocation: dto.siteLocation ?? null,
          circumstances: dto.circumstances ?? null,
          witnesses: dto.witnesses ?? null,
          immediateCare: dto.immediateCare ?? null,
          onSiteCapturedBy: hasOnSite ? user.id : null,
          onSiteCapturedAt: hasOnSite ? now : null,
          createdBy: user.id,
        },
      })

      // Crear la tarjeta mueve al colaborador a GRIS. La transición la dispara
      // el SISTEMA como consecuencia del reporte, no la persona que reporta:
      // por eso no se valida el rol de quien reporta contra la transición.
      await tx.worker.update({
        where: { id: dto.workerId },
        data: { statusLightStateId: gray.id, updatedAt: now },
      })

      await tx.workerStateHistory.create({
        data: {
          id: uuidv7(),
          workerId: dto.workerId,
          fromStateId: worker.statusLightStateId,
          toStateId: gray.id,
          statusLightCode: 'WORKER',
          userId: user.id,
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'supervision.work_accident',
          entityId: id,
          eventType: 'ACCIDENT_REPORTED',
          actorUserId: user.id,
          actorRole: user.roleCode,
          payload: {
            number,
            hotelId: dto.hotelId,
            workerId: dto.workerId,
            reportedBy: user.id,
            inspectorId: inspector?.id ?? null,
            status: hasOnSite ? 'ON_SITE_CAPTURED' : 'REPORTED',
          },
        },
      })
    })

    return this.get(id)
  }

  // Solo EL inspector de la tarjeta, no cualquier inspector: eso cruza filas y
  // no cabe en la tabla de transiciones.
  private assertOwnCard(row: AccidentRow, user: AuthenticatedUser): void {
    if (row.inspector && row.inspector.id !== user.id) {
      throw new ForbiddenException({
        code: 'NOT_YOUR_ACCIDENT',
        message: 'Esta tarjeta la atiende otro Inspector',
      })
    }
  }

  private assertOpen(row: AccidentRow): void {
    if (row.status === CLOSED) {
      throw new ConflictException({
        code: 'ACCIDENT_CLOSED',
        message: 'La tarjeta ya está cerrada',
      })
    }
  }

  private async accident(id: string): Promise<AccidentRow> {
    const row = await this.repo.findById(id)

    if (!row) {
      throw new NotFoundException({
        code: 'ACCIDENT_NOT_FOUND',
        message: 'La tarjeta de accidente no existe',
      })
    }

    return row
  }

  private async state(code: string): Promise<{ id: string }> {
    const row = await this.repo.stateByCode(code)

    if (!row) {
      throw new UnprocessableEntityException({
        code: 'STATE_NOT_FOUND',
        message: `El estado ${code} no está sembrado en el semáforo del Colaborador`,
      })
    }

    return row
  }

  private async nextNumber(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = `${stamp(new Date())}${suffix()}`

      if (!(await this.repo.numberTaken(candidate))) {
        return candidate
      }
    }

    throw new ConflictException({
      code: 'NUMBER_COLLISION',
      message: 'No se pudo generar un número de reporte libre',
    })
  }
}

// Los DTO opcionales llegan con la clave puesta en `undefined`, y eso no es lo
// mismo que ausente para Prisma con exactOptionalPropertyTypes.
// Por el mensaje y no por el codigo de Prisma, igual que `no_shift_overlap` en
// schedules: el nombre de la restriccion es lo estable.
function isCheckViolation(error: unknown, constraint: string): boolean {
  return error instanceof Error && error.message.includes(constraint)
}

function defined<T extends object>(dto: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined))
}

function suffix(): string {
  const pick = (): string => ALPHABET[Math.floor(Math.random() * ALPHABET.length)] ?? 'A'

  return `${pick()}${pick()}`
}

function stamp(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')

  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
  ].join('')
}

function toEntity(row: AccidentRow): AccidentEntity {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    occurredAt: row.occurredAt.toISOString(),
    hotel: row.hotel,
    worker: row.worker,
    reportedBy: row.reportedByUser,
    inspector: row.inspector,
    onSite: {
      siteLocation: row.siteLocation,
      circumstances: row.circumstances,
      witnesses: row.witnesses,
      immediateCare: row.immediateCare,
      capturedBy: row.capturedByUser,
      capturedAt: row.onSiteCapturedAt?.toISOString() ?? null,
    },
    medical: {
      isTransferred: row.isTransferred,
      medicalCenter: row.medicalCenter,
      diagnosis: row.diagnosis,
      disabilityDays: row.disabilityDays,
      medicalNotes: row.medicalNotes,
    },
    closure: {
      medicalDischargeDate: row.medicalDischargeDate?.toISOString().slice(0, 10) ?? null,
      closedBy: row.closedByUser,
      closedAt: row.closedAt?.toISOString() ?? null,
    },
    createdAt: row.createdAt.toISOString(),
  }
}
