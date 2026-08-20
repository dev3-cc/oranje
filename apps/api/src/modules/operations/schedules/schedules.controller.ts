import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { CreateEntryDto } from './dto/create-entry.dto.js'
import { CreateScheduleDto } from './dto/create-schedule.dto.js'
import { EntryEntity, ScheduleEntity, SchedulesService } from './schedules.service.js'

@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Requires('schedule', 'read_department')
  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<{ data: ScheduleEntity[] }> {
    return { data: await this.schedules.list(user) }
  }

  @Requires('schedule', 'read_department')
  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: ScheduleEntity }> {
    return { data: await this.schedules.get(id) }
  }

  @Requires('schedule', 'update')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ScheduleEntity }> {
    return { data: await this.schedules.create(dto, user) }
  }

  @Requires('schedule', 'read_department')
  @Get(':id/entries')
  async entries(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: EntryEntity[] }> {
    return { data: await this.schedules.entries(id) }
  }

  @Requires('schedule', 'update')
  @Post(':id/entries')
  @HttpCode(HttpStatus.CREATED)
  async addEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: EntryEntity }> {
    return { data: await this.schedules.addEntry(id, dto, user) }
  }

  @Requires('schedule', 'update')
  @Delete(':id/entries/:entryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.schedules.removeEntry(id, entryId, user)
  }
}
