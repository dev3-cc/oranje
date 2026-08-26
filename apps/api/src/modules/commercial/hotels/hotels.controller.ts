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
import { HotelsService, Paginated } from './hotels.service.js'

@Controller('hotels')
export class HotelsController {
  constructor(
    private readonly hotels: HotelsService,
    private readonly permissions: PermissionsService,
  ) {}

  @Requires('pipeline', 'read')
  @Get()
  list(@Query() query: QueryHotelsDto): Promise<Paginated<HotelEntity>> {
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
    const isOwnHotel = user.hotelId === id
    if (!isOwnHotel && !(await this.permissions.can(user.roleCode, 'pipeline', 'read'))) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Ver la ficha de otro hotel requiere permisos de Ventas',
      })
    }

    return { data: await this.hotels.get(id) }
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
