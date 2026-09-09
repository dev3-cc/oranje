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
import { PermissionsService } from '../../identity/index.js'

import { CreateHotelDto } from './dto/create-hotel.dto.js'
import { QueryHotelsDto } from './dto/query-hotels.dto.js'
import { UpdateHotelDto } from './dto/update-hotel.dto.js'
import type { HotelEntity } from './entities/hotel.entity.js'
import { HotelsService, Paginated, PunchQrEntity } from './hotels.service.js'

@Controller('hotels')
export class HotelsController {
  constructor(
    private readonly hotels: HotelsService,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * Sin `@Requires`: la lista es de Ventas (`pipeline:read`), pero el
   * Administrador la necesita para dar de alta cuentas del hotel
   * (`users:manage_hotel`, Reglas de Negocio · Cuentas del hotel).
   */
  @Get()
  async list(
    @Query() query: QueryHotelsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Paginated<HotelEntity>> {
    await this.assertCanSeeHotels(user)

    return this.hotels.list(query)
  }

  /**
   * Sin `@Requires`: la ficha de un hotel es de Ventas (`pipeline:read`),
   * PERO tu propio hotel lo puedes leer siempre — el Supervisor y los
   * Managers necesitan su nombre, su foto y su geocerca sin permisos de
   * Ventas. Mismo patrón que el territorio.
   */
  @Get(':id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: HotelEntity }> {
    if (user.hotelId !== id) {
      await this.assertCanSeeHotels(user)
    }

    return { data: await this.hotels.get(id) }
  }

  private async assertCanSeeHotels(user: AuthenticatedUser): Promise<void> {
    const [sales, admin] = await Promise.all([
      this.permissions.can(user.roleCode, 'pipeline', 'read'),
      this.permissions.can(user.roleCode, 'users', 'manage_hotel'),
    ])

    if (!sales && !admin) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Ver los hoteles requiere permisos de Ventas o del Administrador',
      })
    }
  }

  @Requires('pipeline', 'update_hotel_profile')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateHotelDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: HotelEntity }> {
    return { data: await this.hotels.create(dto, user.id) }
  }

  /**
   * El QR de ponche del hotel, para imprimir. Lo alcanzan quien vende el hotel
   * (BD, BDC) y quien lo opera (Supervisor, Managers) — pero los roles del
   * hotel solo el SUYO: el permiso dice qué, el hotelId del token dice cuál.
   */
  @Requires('hotel', 'punch_qr')
  @Get(':id/punch-qr')
  async punchQr(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: PunchQrEntity }> {
    this.assertHotelScope(id, user)
    return { data: await this.hotels.punchQr(id) }
  }

  @Requires('hotel', 'punch_qr')
  @Post(':id/punch-qr/regenerate')
  async regeneratePunchQr(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: PunchQrEntity }> {
    this.assertHotelScope(id, user)
    return { data: await this.hotels.regeneratePunchQr(id, user) }
  }

  private assertHotelScope(id: string, user: AuthenticatedUser): void {
    if (user.hotelId !== null && user.hotelId !== undefined && user.hotelId !== id) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'El QR de ponche de otro hotel no te corresponde',
      })
    }
  }

  @Requires('pipeline', 'update_hotel_profile')
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHotelDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: HotelEntity }> {
    return { data: await this.hotels.update(id, dto, user.id) }
  }
}
