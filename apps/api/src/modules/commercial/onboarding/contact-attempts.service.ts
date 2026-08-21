import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { AttemptRow, ContactAttemptsRepository } from './contact-attempts.repository.js'
import type { CreateContactAttemptDto } from './dto/create-contact-attempt.dto.js'
import type { UpdateContactAttemptDto } from './dto/update-contact-attempt.dto.js'
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

  /**
   * Corrección: SOLO el autor. La bitácora registra hechos, pero quien los
   * capturó puede enmendar su propio dedazo — con huella en el journal.
   */
  async update(
    prospectId: string,
    attemptId: string,
    dto: UpdateContactAttemptDto,
    user: AuthenticatedUser,
  ): Promise<ContactAttemptEntity> {
    const prospect = await this.prospect(prospectId)
    await this.ownAttempt(attemptId, prospectId, user)

    if (prospect.closedAt !== null) {
      throw new ConflictException({
        code: 'PROSPECT_CLOSED',
        message: 'Un ciclo comercial cerrado no se corrige',
      })
    }

    if (dto.occurredAt && dto.occurredAt.getTime() > Date.now()) {
      throw new UnprocessableEntityException({
        code: 'ATTEMPT_IN_FUTURE',
        message: 'Un intento de contacto no puede ocurrir en el futuro',
      })
    }

    let hotelContactId: string | null | undefined = undefined

    if (dto.hotelContactId !== undefined) {
      if (dto.hotelContactId === null) {
        hotelContactId = null
      } else {
        const contact = await this.repo.contactOfHotel(dto.hotelContactId, prospect.hotelId)

        if (!contact) {
          throw new UnprocessableEntityException({
            code: 'CONTACT_NOT_IN_HOTEL',
            message: 'Ese contacto no es de este hotel',
          })
        }

        hotelContactId = contact.id
      }
    }

    return toEntity(
      await this.repo.update(
        attemptId,
        {
          ...(dto.attemptType !== undefined ? { attemptType: dto.attemptType } : {}),
          ...(dto.outcome !== undefined ? { outcome: dto.outcome } : {}),
          ...(hotelContactId !== undefined ? { hotelContactId } : {}),
          ...(dto.occurredAt !== undefined ? { occurredAt: dto.occurredAt } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
        { userId: user.id, roleCode: user.roleCode },
      ),
    )
  }

  /** Borrado: SOLO el autor — para el intento de prueba o el capturado doble. */
  async remove(prospectId: string, attemptId: string, user: AuthenticatedUser): Promise<void> {
    const prospect = await this.prospect(prospectId)
    const attempt = await this.ownAttempt(attemptId, prospectId, user)

    if (prospect.closedAt !== null) {
      throw new ConflictException({
        code: 'PROSPECT_CLOSED',
        message: 'Un ciclo comercial cerrado no se corrige',
      })
    }

    await this.repo.remove(
      attemptId,
      { userId: user.id, roleCode: user.roleCode },
      { attemptType: attempt.attemptType, outcome: attempt.outcome },
    )
  }

  private async ownAttempt(
    attemptId: string,
    prospectId: string,
    user: AuthenticatedUser,
  ): Promise<AttemptRow> {
    const attempt = await this.repo.find(attemptId, prospectId)

    if (!attempt) {
      throw new NotFoundException({ code: 'ATTEMPT_NOT_FOUND', message: 'El intento no existe' })
    }

    if (attempt.user.id !== user.id) {
      throw new ForbiddenException({
        code: 'ATTEMPT_NOT_OWN',
        message: 'Solo quien registró el intento puede corregirlo o eliminarlo',
      })
    }

    return attempt
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
