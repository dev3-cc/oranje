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

import { CreateManualPunchDto, CreatePunchDto } from './dto/create-punch.dto.js'
import { ReviewDayDto } from './dto/review-day.dto.js'
import { DayEntity, PunchResult, TimesheetEntity, TimesheetsService } from './timesheets.service.js'

@Controller()
export class TimesheetsController {
  constructor(private readonly timesheets: TimesheetsService) {}

  @Requires('timesheet', 'read_department')
  @Get('timesheets')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
  ): Promise<{ data: TimesheetEntity[] }> {
    return { data: await this.timesheets.list(user, status) }
  }

  @Requires('timesheet', 'read_department')
  @Get('timesheets/:id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: TimesheetEntity }> {
    return { data: await this.timesheets.get(id) }
  }

  @Requires('timesheet', 'read_department')
  @Post('punches')
  @HttpCode(HttpStatus.CREATED)
  async punch(
    @Body() dto: CreatePunchDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: PunchResult }> {
    return { data: await this.timesheets.punch(dto, user) }
  }

  @Requires('timesheet', 'create_manual_punch')
  @Post('punches/manual')
  @HttpCode(HttpStatus.CREATED)
  async manualPunch(
    @Body() dto: CreateManualPunchDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: PunchResult }> {
    return { data: await this.timesheets.manualPunch(dto, user) }
  }

  @Requires('timesheet', 'review_punches')
  @Post('timesheet-days/:id/review')
  @HttpCode(HttpStatus.OK)
  async reviewDay(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDayDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: DayEntity }> {
    return { data: await this.timesheets.reviewDay(id, dto.note, user) }
  }

  @Requires('timesheet', 'review_punches')
  @Post('timesheets/:id/submit')
  @HttpCode(HttpStatus.OK)
  async submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: TimesheetEntity }> {
    return { data: await this.timesheets.submit(id, user) }
  }

  @Requires('timesheet', 'approve_hours')
  @Post('timesheets/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: TimesheetEntity }> {
    return { data: await this.timesheets.approve(id, user) }
  }
}
