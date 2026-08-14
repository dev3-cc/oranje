import {
  Body,
  Controller,
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

import { CreateHotelDto } from './dto/create-hotel.dto.js'
import { QueryHotelsDto } from './dto/query-hotels.dto.js'
import { UpdateHotelDto } from './dto/update-hotel.dto.js'
import type { HotelEntity } from './entities/hotel.entity.js'
import { HotelsService, Paginado } from './hotels.service.js'

@Controller('hotels')
export class HotelsController {
  constructor(private readonly hotels: HotelsService) {}

  @Requires('pipeline', 'read')
  @Get()
  list(@Query() query: QueryHotelsDto): Promise<Paginado<HotelEntity>> {
    return this.hotels.list(query)
  }

  @Requires('pipeline', 'read')
  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: HotelEntity }> {
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
