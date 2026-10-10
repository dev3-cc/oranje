import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common'

import { CurrentUser, Public, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { SchedulerTokenService } from '../../../common/security/scheduler-token.service.js'
import { PermissionsService } from '../../identity/index.js'

import { CreateManualPunchDto, CreatePunchDto } from './dto/create-punch.dto.js'
import { ReviewDayDto } from './dto/review-day.dto.js'
import { DayEntity, PunchResult, TimesheetEntity, TimesheetsService } from './timesheets.service.js'

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
    private readonly schedulerTokens: SchedulerTokenService,
  ) {}

  /**
   * La detección de inasistencias, que corre el programador de tareas.
   *
   * No hay sesión: lo autentica el token OIDC de Google, igual que el barrido
   * de asignaciones vencidas y el consumidor de eventos. Es lo único del
   * semáforo que no se puede disparar con un hecho, porque no hay evento
   * cuando algo NO pasa (Hugo, 2026-10-10).
   */
  @Public()
  @Post('timesheets/detect-absences/scheduled')
  @HttpCode(HttpStatus.OK)
  async detectAbsences(
    @Headers('authorization') authorization: string | undefined,
  ): Promise<{ data: { registradas: number; avisadas: number } }> {
    await this.schedulerTokens.verify(authorization)

    return { data: await this.timesheets.detectAbsences() }
  }

  @Get('timesheets')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    /* El periodo acota en la consulta, no después: así el tope del listado
       no se alcanza por el paso del tiempo (Hugo, 2026-10-05). */
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<{ data: TimesheetEntity[] }> {
    const allHotels = await this.readScope(user)

    return { data: await this.timesheets.list(user, status, allHotels, { from, to }) }
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
    await this.readScope(user)

    return { data: await this.timesheets.get(id) }
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
