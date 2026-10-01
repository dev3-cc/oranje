import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { PermissionsService } from '../auth/permissions.service.js'

import { CreateHotelUserDto } from './dto/create-hotel-user.dto.js'
import { QueryHotelUsersDto } from './dto/query-hotel-users.dto.js'
import { UpdateHotelUserDto } from './dto/update-hotel-user.dto.js'
import type { HotelUserEntity, HotelUserWithInvitation } from './entities/hotel-user.entity.js'
import { HotelUsersService } from './hotel-users.service.js'
import type { Paginated } from './staff-users.service.js'

/**
 * Las cuentas de UN hotel. Escribir aquí lo pueden dos roles por dos caminos
 * (Reglas de Negocio · Cuentas del hotel): el BDC desde la ficha del hotel
 * (`conversion:create_hotel_user`, el primer Manager General nace ahí) y el
 * Administrador desde Usuarios (`users:manage_hotel`). `@Requires` solo sabe
 * de un par, así que el «uno u otro» se resuelve aquí.
 */
@Controller('hotels/:hotelId/users')
export class HotelUsersController {
  constructor(
    private readonly users: HotelUsersService,
    private readonly permissions: PermissionsService,
  ) {}

  @Requires('pipeline', 'read')
  @Get()
  async list(
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<{ data: HotelUserEntity[] }> {
    return { data: await this.users.list(hotelId, includeInactive === 'true') }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Body() dto: CreateHotelUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: HotelUserWithInvitation }> {
    await this.assertCanManage(user)

    return { data: await this.users.create(hotelId, dto, user) }
  }

  @Patch(':id')
  async update(
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHotelUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: HotelUserEntity }> {
    await this.assertCanManage(user)

    return { data: await this.users.update(hotelId, id, dto, user) }
  }

  @Post(':id/resend-invitation')
  @HttpCode(HttpStatus.OK)
  async resendInvitation(
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: HotelUserWithInvitation }> {
    await this.assertCanManage(user)

    return { data: await this.users.resendInvitation(hotelId, id, user) }
  }

  /**
   * Tres vías llegan aquí y `@Requires` solo sabe de un par, así que el «uno
   * u otro» se resuelve a mano: el Administrador desde Usuarios, el BDC desde
   * la conversión, y —desde el 2026-09-30— quien puede **invitar**: el BD en
   * los hoteles de sus zonas y el propio hotel en el suyo.
   *
   * Lo que este guard NO decide es a QUÉ rol se puede invitar ni en qué
   * hotel: eso vive en el servicio, con los datos delante.
   */
  private async assertCanManage(user: AuthenticatedUser): Promise<void> {
    const [conversion, admin, invite] = await Promise.all([
      this.permissions.can(user.roleCode, 'conversion', 'create_hotel_user'),
      this.permissions.can(user.roleCode, 'users', 'manage_hotel'),
      this.permissions.can(user.roleCode, 'users', 'invite_hotel'),
    ])

    if (!conversion && !admin && !invite) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Tu rol no administra las cuentas del hotel',
      })
    }
  }
}

/**
 * El directorio del Administrador: las cuentas de TODOS los hoteles en una
 * lista. Controlador aparte para no chocar con `GET /users/:id` del personal.
 */
/**
 * La cola del Administrador: cuentas gerenciales que un hotel propuso y
 * siguen esperando su visto bueno (Hugo, 2026-09-30).
 *
 * Fuera del controlador de un hotel porque no son de uno: son de todos.
 */
@Controller('hotel-users/pending')
export class HotelUsersPendingController {
  constructor(private readonly users: HotelUsersService) {}

  @Requires('users', 'approve_hotel')
  @Get()
  async pending(): Promise<{ data: HotelUserEntity[] }> {
    return { data: await this.users.pendingApprovals() }
  }

  @Requires('users', 'approve_hotel')
  @Post(':id/approve')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: HotelUserWithInvitation }> {
    return { data: await this.users.approve(id, user) }
  }
}

@Controller('hotel-users')
export class HotelUsersDirectoryController {
  constructor(private readonly users: HotelUsersService) {}

  @Requires('users', 'manage_hotel')
  @Get()
  directory(@Query() query: QueryHotelUsersDto): Promise<Paginated<HotelUserEntity>> {
    return this.users.directory(query)
  }
}
