import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import type { CreateHotelUserDto } from './dto/create-hotel-user.dto.js'
import { GENERAL_MANAGER } from './dto/create-hotel-user.dto.js'
import type { HotelUserEntity } from './entities/hotel-user.entity.js'
import { HotelUserRow, HotelUsersRepository } from './hotel-users.repository.js'

@Injectable()
export class HotelUsersService {
  constructor(private readonly repo: HotelUsersRepository) {}

  async list(hotelId: string, includeInactive: boolean): Promise<HotelUserEntity[]> {
    await this.assertHotel(hotelId)

    return (await this.repo.listAll(hotelId, includeInactive)).map(toEntity)
  }

  async create(
    hotelId: string,
    dto: CreateHotelUserDto,
    actor: AuthenticatedUser,
  ): Promise<HotelUserEntity> {
    await this.assertHotel(hotelId)

    const role = await this.repo.roleByCode(dto.roleCode)

    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: `El rol ${dto.roleCode} no existe`,
      })
    }

    if (await this.repo.emailTaken(dto.email)) {
      throw new ConflictException({
        code: 'EMAIL_TAKEN',
        message: `Ya existe un usuario con el correo ${dto.email}`,
      })
    }

    const departmentId = await this.resolveDepartment(dto)

    if (dto.reportsToUserId && !(await this.repo.userOfHotel(dto.reportsToUserId, hotelId))) {
      throw new UnprocessableEntityException({
        code: 'SUPERVISOR_NOT_IN_HOTEL',
        message: 'A quien reporta debe ser un usuario del mismo hotel',
      })
    }

    return toEntity(
      await this.repo.create({
        hotelId,
        email: dto.email,
        fullName: dto.fullName,
        roleId: role.id,
        roleCode: dto.roleCode,
        departmentId,
        reportsToUserId: dto.reportsToUserId ?? null,
        actorUserId: actor.id,
        actorRole: actor.roleCode,
      }),
    )
  }

  private async resolveDepartment(dto: CreateHotelUserDto): Promise<string | null> {
    if (dto.roleCode === GENERAL_MANAGER) {
      if (dto.departmentId) {
        throw new UnprocessableEntityException({
          code: 'DEPARTMENT_NOT_ALLOWED',
          message: 'El Manager General cubre todos los departamentos de su hotel',
        })
      }

      return null
    }

    if (!dto.departmentId) {
      throw new UnprocessableEntityException({
        code: 'DEPARTMENT_REQUIRED',
        message: `El rol ${dto.roleCode} necesita un departamento`,
      })
    }

    if (!(await this.repo.departmentExists(dto.departmentId))) {
      throw new NotFoundException({
        code: 'DEPARTMENT_NOT_FOUND',
        message: 'El departamento no existe',
      })
    }

    return dto.departmentId
  }

  private async assertHotel(hotelId: string): Promise<void> {
    if (!(await this.repo.hotelExists(hotelId))) {
      throw new NotFoundException({ code: 'HOTEL_NOT_FOUND', message: 'El hotel no existe' })
    }
  }
}

function toEntity(row: HotelUserRow): HotelUserEntity {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    department: row.department,
    reportsToUserId: row.reportsToUserId,
    hasAccount: row.firebaseUid !== null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  }
}
