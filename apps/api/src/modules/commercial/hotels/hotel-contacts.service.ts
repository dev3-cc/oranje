import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'

import type { CreateHotelContactDto } from './dto/create-hotel-contact.dto.js'
import type { UpdateHotelContactDto } from './dto/update-hotel-contact.dto.js'
import type { HotelContactEntity } from './entities/hotel-contact.entity.js'
import { ContactRow, HotelContactsRepository } from './hotel-contacts.repository.js'

@Injectable()
export class HotelContactsService {
  constructor(private readonly repo: HotelContactsRepository) {}

  async list(hotelId: string, includeInactive: boolean): Promise<HotelContactEntity[]> {
    await this.assertHotel(hotelId)

    return (await this.repo.findByHotel(hotelId, includeInactive)).map(toEntity)
  }

  async create(hotelId: string, dto: CreateHotelContactDto): Promise<HotelContactEntity> {
    await this.assertHotel(hotelId)

    return toEntity(await this.repo.create(hotelId, dto, dto.isPrimary))
  }

  async update(
    hotelId: string,
    id: string,
    dto: UpdateHotelContactDto,
  ): Promise<HotelContactEntity> {
    const actual = await this.assertContacto(hotelId, id)

    const phone = dto.phone === undefined ? actual.phone : dto.phone
    const email = dto.email === undefined ? actual.email : dto.email

    if (phone === null && email === null) {
      throw new UnprocessableEntityException({
        code: 'CONTACT_UNREACHABLE',
        message: 'El contacto se quedaría sin teléfono ni correo',
      })
    }

    let primary = dto.isPrimary

    if (dto.isActive === false) {
      primary = false
    }

    if (dto.isActive === true && actual.isActive === false && actual.isPrimary) {
      primary = (await this.repo.hasActivePrimary(hotelId, id)) ? false : true
    }

    return toEntity(
      await this.repo.update(
        hotelId,
        id,
        {
          fullName: dto.fullName,
          jobTitle: dto.jobTitle,
          phone: dto.phone,
          email: dto.email,
          isActive: dto.isActive,
        },
        primary,
      ),
    )
  }

  async remove(hotelId: string, id: string): Promise<void> {
    const actual = await this.assertContacto(hotelId, id)

    const intentos = actual._count.attempts

    if (intentos > 0) {
      throw new ConflictException({
        code: 'CONTACT_HAS_ATTEMPTS',
        message: `Tiene ${intentos} ${intentos === 1 ? 'intento' : 'intentos'} de contacto registrado${intentos === 1 ? '' : 's'}. Desactívalo en vez de borrarlo`,
      })
    }

    try {
      await this.repo.delete(id)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException({
          code: 'CONTACT_IN_USE',
          message: 'Otra parte del sistema lo referencia. Desactívalo en vez de borrarlo',
        })
      }

      throw error
    }
  }

  private async assertHotel(hotelId: string): Promise<void> {
    if (!(await this.repo.hotelExists(hotelId))) {
      throw new NotFoundException({ code: 'HOTEL_NOT_FOUND', message: 'El hotel no existe' })
    }
  }

  private async assertContacto(hotelId: string, id: string): Promise<ContactRow> {
    const row = await this.repo.findOne(hotelId, id)

    if (!row) {
      throw new NotFoundException({
        code: 'CONTACT_NOT_FOUND',
        message: 'El contacto no existe en este hotel',
      })
    }

    return row
  }
}

function toEntity(row: ContactRow): HotelContactEntity {
  return {
    id: row.id,
    hotelId: row.hotelId,
    fullName: row.fullName,
    jobTitle: row.jobTitle,
    phone: row.phone,
    email: row.email,
    isPrimary: row.isPrimary,
    isActive: row.isActive,
    attemptCount: row._count.attempts,
    canDelete: row._count.attempts === 0,
    createdAt: row.createdAt.toISOString(),
  }
}
