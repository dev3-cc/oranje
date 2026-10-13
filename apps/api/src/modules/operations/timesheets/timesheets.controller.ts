import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { PermissionsService } from '../../identity/index.js'

import { CorrectPunchDto, CreateManualPunchDto, CreatePunchDto } from './dto/create-punch.dto.js'
import { SetDayStatusDto } from './dto/day-status.dto.js'
import { ListTimesheetsDto } from './dto/list-timesheets.dto.js'
import { SetPayOverrideDto } from './dto/pay-override.dto.js'
import { ReviewDayDto } from './dto/review-day.dto.js'
import {
  DayEntity,
  PunchResult,
  TimesheetEntity,
  TimesheetListEntity,
  TimesheetsService,
} from './timesheets.service.js'

/**
 * Leer el Timesheet lo pueden dos alcances: el del hotel (`read_department`,
 * acotado por hotel y departamento, D-09) y el de todos los hoteles
 * (`read_all_hotels`, solo lectura: el Observador y, con su Matriz, la
 * Contadora). `@Requires` solo sabe de un par, así que el «uno u otro» se
 * resuelve aquí. Escribir sigue exigiendo su permiso propio.
 */
@Controller()
export class TimesheetsController {
  constructor(
    private readonly timesheets: TimesheetsService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get('timesheets')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTimesheetsDto,
  ): Promise<{ data: TimesheetListEntity[] }> {
    const allHotels = await this.readScope(user)

    return { data: await this.timesheets.list(user, query, allHotels) }
  }

  // Antes que `:id`, o Nest lee "me" como un uuid.
  @Requires('timesheet', 'read_own')
  @Get('timesheets/me')
  async mine(@CurrentUser() user: AuthenticatedUser): Promise<{ data: TimesheetEntity[] }> {
    return { data: await this.timesheets.mine(user) }
  }

  @Get('timesheets/:id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: TimesheetEntity }> {
    const allHotels = await this.readScope(user)

    return { data: await this.timesheets.getScoped(id, user, allHotels) }
  }

  @Requires('timesheet', 'punch')
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

  @Requires('timesheet', 'correct_punch')
  @Patch('punches/:id')
  @HttpCode(HttpStatus.OK)
  async correctPunch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CorrectPunchDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: PunchResult }> {
    return { data: await this.timesheets.correctPunch(id, dto, user) }
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

  /**
   * Sin Schedule, un día sin ponches no tiene fila: con qué se marca
   * (Descanso, OFF…) antes de enviar la semana — mismo alcance que corregir
   * una marca (Hugo, 2026-10-12).
   */
  @Requires('timesheet', 'review_punches')
  @Put('timesheets/:id/day-status')
  @HttpCode(HttpStatus.OK)
  async setDayStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetDayStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: DayEntity }> {
    const allHotels = await this.readScope(user)

    return {
      data: await this.timesheets.setDayStatus(
        id,
        new Date(`${dto.workDate}T00:00:00Z`),
        dto.dayStatusId,
        user,
        allHotels,
      ),
    }
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

  /**
   * Corrección de Contabilidad sobre la vista previa de pago (Hugo,
   * 2026-10-08): tarifa y reparto de horas. El mismo permiso que prepara la
   * corrida, `payroll:generate` — Contadora y Manager de Contabilidad.
   */
  @Requires('payroll', 'generate')
  @Put('timesheets/:id/pay-override')
  @HttpCode(HttpStatus.OK)
  async setPayOverride(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPayOverrideDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: TimesheetListEntity }> {
    return { data: await this.timesheets.setPayOverride(id, dto, user) }
  }

  @Requires('payroll', 'generate')
  @Delete('timesheets/:id/pay-override')
  @HttpCode(HttpStatus.OK)
  async clearPayOverride(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ data: TimesheetListEntity }> {
    return { data: await this.timesheets.clearPayOverride(id) }
  }

  /** `true` = todos los hoteles; `false` = el hotel de quien pregunta. */
  private async readScope(user: AuthenticatedUser): Promise<boolean> {
    const [allHotels, ownHotel] = await Promise.all([
      this.permissions.can(user.roleCode, 'timesheet', 'read_all_hotels'),
      this.permissions.can(user.roleCode, 'timesheet', 'read_department'),
    ])

    if (!allHotels && !ownHotel) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Tu rol no puede ver el Timesheet',
      })
    }

    return allHotels
  }
}
