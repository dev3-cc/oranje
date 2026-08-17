import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { AttemptRow, ContactAttemptsRepository } from './contact-attempts.repository.js'
import type { CreateContactAttemptDto } from './dto/create-contact-attempt.dto.js'
import type { AttemptSummary, ContactAttemptEntity } from './entities/contact-attempt.entity.js'

@Injectable()
export class ContactAttemptsService {
  constructor(private readonly repo: ContactAttemptsRepository) {}

  async create(
    prospectId: string,
    dto: CreateContactAttemptDto,
    user: AuthenticatedUser,
  ): Promise<ContactAttemptEntity> {
    const prospect = await this.prospect(prospectId)

    if (prospect.closedAt !== null) {
      throw new ConflictException({
        code: 'PROSPECT_CLOSED',
        message: 'No se registran intentos en un ciclo comercial cerrado',
      })
    }

    if (dto.occurredAt && dto.occurredAt.getTime() > Date.now()) {
      throw new UnprocessableEntityException({
        code: 'ATTEMPT_IN_FUTURE',
        message: 'Un intento de contacto no puede ocurrir en el futuro',
      })
    }

    let hotelContactId: string | null = null

    if (dto.hotelContactId) {
      const contact = await this.repo.contactOfHotel(dto.hotelContactId, prospect.hotelId)

      if (!contact) {
        throw new UnprocessableEntityException({
          code: 'CONTACT_NOT_IN_HOTEL',
          message: 'Ese contacto no es de este hotel',
        })
      }

      hotelContactId = contact.id
    }

    return toEntity(
      await this.repo.create({
        prospectId,
        hotelId: prospect.hotelId,
        hotelContactId,
        attemptType: dto.attemptType,
        outcome: dto.outcome,
        occurredAt: dto.occurredAt ?? null,
        notes: dto.notes ?? null,
        userId: user.id,
        roleCode: user.roleCode,
      }),
    )
  }

  async list(prospectId: string): Promise<{ data: ContactAttemptEntity[]; meta: AttemptSummary }> {
    await this.prospect(prospectId)

    const [rows, summaryOf] = await Promise.all([
      this.repo.listAll(prospectId),
      this.repo.summaryOf(prospectId),
    ])

    return {
      data: rows.map(toEntity),
      meta: {
        total: summaryOf.total,
        byOutcome: summaryOf.byOutcome,
        lastAttemptAt: summaryOf.lastAttemptAt?.toISOString() ?? null,
      },
    }
  }

  private async prospect(
    id: string,
  ): Promise<{ id: string; hotelId: string; closedAt: Date | null }> {
    const row = await this.repo.prospect(id)

    if (!row) {
      throw new NotFoundException({ code: 'PROSPECT_NOT_FOUND', message: 'El prospecto no existe' })
    }

    return row
  }
}

function toEntity(row: AttemptRow): ContactAttemptEntity {
  return {
    id: row.id,
    attemptType: row.attemptType,
    outcome: row.outcome,
    contact: row.hotelContact,
    user: row.user,
    occurredAt: row.occurredAt.toISOString(),
    notes: row.notes,
  }
}
