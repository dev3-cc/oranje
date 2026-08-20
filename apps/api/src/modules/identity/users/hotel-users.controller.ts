import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { CreateHotelUserDto } from './dto/create-hotel-user.dto.js'
import type { HotelUserEntity } from './entities/hotel-user.entity.js'
import { HotelUsersService } from './hotel-users.service.js'

@Controller('hotels/:hotelId/users')
export class HotelUsersController {
  constructor(private readonly users: HotelUsersService) {}

  @Requires('pipeline', 'read')
  @Get()
  async list(
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<{ data: HotelUserEntity[] }> {
    return { data: await this.users.list(hotelId, includeInactive === 'true') }
  }

  @Requires('conversion', 'create_hotel_user')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Body() dto: CreateHotelUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: HotelUserEntity }> {
    return { data: await this.users.create(hotelId, dto, user) }
  }
}
