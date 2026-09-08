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

import { AuditBoard, AuditsService } from './audits.service.js'
import {
  CreateAuditDto,
  QueryAuditsDto,
  QueryLastPerWorkerDto,
  UpdateAuditDto,
} from './dto/audit.dto.js'
import type { AuditEntity, LastAuditPerWorker } from './entities/audit.entity.js'

@Controller('audits')
export class AuditsController {
  constructor(private readonly audits: AuditsService) {}

  @Requires('audits', 'create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateAuditDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: AuditEntity }> {
    return { data: await this.audits.create(dto, user) }
  }

  // Antes que `:id`: si no, Nest lo confunde con un id.
  @Requires('audits', 'read')
  @Get('last-per-worker')
  async lastPerWorker(
    @Query() query: QueryLastPerWorkerDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: LastAuditPerWorker[] }> {
    return { data: await this.audits.lastPerWorker(query.hotelId, user) }
  }

  @Requires('audits', 'read')
  @Get()
  list(
    @Query() query: QueryAuditsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AuditBoard> {
    return this.audits.list(query, user)
  }

  @Requires('audits', 'read')
  @Get(':id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: AuditEntity }> {
    return { data: await this.audits.get(id, user) }
  }

  @Requires('audits', 'update')
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAuditDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: AuditEntity }> {
    return { data: await this.audits.update(id, dto, user) }
  }
}
