import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common'

import { Requires } from '../../../common/decorators/index.js'

import { CreateHotelContactDto } from './dto/create-hotel-contact.dto.js'
import { UpdateHotelContactDto } from './dto/update-hotel-contact.dto.js'
import type { HotelContactEntity } from './entities/hotel-contact.entity.js'
import { HotelContactsService } from './hotel-contacts.service.js'

@Controller('hotels/:hotelId/contacts')
export class HotelContactsController {
  constructor(private readonly contacts: HotelContactsService) {}

  @Requires('pipeline', 'read')
  @Get()
  async list(
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<{ data: HotelContactEntity[] }> {
    return { data: await this.contacts.list(hotelId, includeInactive === 'true') }
  }

  @Requires('pipeline', 'update_hotel_profile')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Body() dto: CreateHotelContactDto,
  ): Promise<{ data: HotelContactEntity }> {
    return { data: await this.contacts.create(hotelId, dto) }
  }

  @Requires('pipeline', 'update_hotel_profile')
  @Patch(':id')
  async update(
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHotelContactDto,
  ): Promise<{ data: HotelContactEntity }> {
    return { data: await this.contacts.update(hotelId, id, dto) }
  }

  @Requires('pipeline', 'update_hotel_profile')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.contacts.remove(hotelId, id)
  }
}
