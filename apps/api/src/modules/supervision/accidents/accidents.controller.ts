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

import { AccidentEntity, AccidentsService } from './accidents.service.js'
import {
  CaptureOnSiteDto,
  CloseAccidentDto,
  MedicalFollowUpDto,
  QueryAccidentsDto,
  ReportAccidentDto,
  ReportOwnAccidentDto,
} from './dto/accident.dto.js'

@Controller('accidents')
export class AccidentsController {
  constructor(private readonly accidents: AccidentsService) {}

  @Requires('accident', 'read')
  @Get()
  async list(@Query() query: QueryAccidentsDto): Promise<{ data: AccidentEntity[] }> {
    return { data: await this.accidents.list(query) }
  }

  // Antes que `:id`. Escenario A: el colaborador reporta desde la app y no
  // manda su propio id — sale de su cuenta (RF-C-05).
  @Requires('accident', 'report_own')
  @Post('me')
  @HttpCode(HttpStatus.CREATED)
  async reportOwn(
    @Body() dto: ReportOwnAccidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: AccidentEntity }> {
    return { data: await this.accidents.reportOwn(dto, user) }
  }

  @Requires('accident', 'read')
  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: AccidentEntity }> {
    return { data: await this.accidents.get(id) }
  }

  // Escenario B: lo reporta el hotel, y puede traer ya lo presencial.
  @Requires('accident', 'report')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async report(
    @Body() dto: ReportAccidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: AccidentEntity }> {
    return { data: await this.accidents.report(dto, user) }
  }

  @Requires('accident', 'capture_on_site')
  @Patch(':id/on-site')
  async captureOnSite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CaptureOnSiteDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: AccidentEntity }> {
    return { data: await this.accidents.captureOnSite(id, dto, user) }
  }

  @Requires('accident', 'medical_follow_up')
  @Patch(':id/medical')
  async medicalFollowUp(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MedicalFollowUpDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: AccidentEntity }> {
    return { data: await this.accidents.medicalFollowUp(id, dto, user) }
  }

  // Cerrar devuelve al colaborador a Verde fuerte, y exige alta médica: lo
  // vuelve a exigir un CHECK.
  @Requires('accident', 'close')
  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  async close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseAccidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: AccidentEntity }> {
    return { data: await this.accidents.close(id, dto, user) }
  }
}
