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

import {
  ChangeStateDto,
  CreateWorkerDto,
  QueryWorkersDto,
  UpdateWorkerDto,
} from './dto/create-worker.dto.js'
import type { WorkerEntity } from './entities/worker.entity.js'
import { TransitionOption, WorkerBoard, WorkersService } from './workers.service.js'

@Controller('workers')
export class WorkersController {
  constructor(private readonly workers: WorkersService) {}

  /**
   * Sin `@Requires`: dos permisos válidos con alcances distintos —
   * Reclutamiento ve el Pool, el hotel ve SUS asignados (Mi Personal).
   * Decide el servicio, como en requisiciones y territorio.
   */
  @Get()
  list(
    @Query() query: QueryWorkersDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WorkerBoard> {
    return this.workers.list(query, user)
  }

  /**
   * Sin `@Requires`: dos permisos válidos con alcances distintos.
   * `recruitment:search_candidates` ve el Pool entero; `staff:read_history` ve
   * a quien tiene asignado (Mi Personal). Decide el servicio, como en
   * requisiciones y territorio.
   */
  @Get(':id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: WorkerEntity }> {
    return { data: await this.workers.getScoped(id, user) }
  }

  @Requires('recruitment', 'create_worker')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateWorkerDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: WorkerEntity }> {
    return { data: await this.workers.create(dto, user) }
  }

  @Requires('recruitment', 'update_worker')
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkerDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: WorkerEntity }> {
    return { data: await this.workers.update(id, dto, user) }
  }

  @Requires('recruitment', 'search_candidates')
  @Get(':id/transitions')
  async transitions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: TransitionOption[] }> {
    return { data: await this.workers.available(id, user) }
  }

  /**
   * Sin `@Requires`: `recruitment:validate_signup` mueve el semáforo completo;
   * `staff:set_standby` solo manda a Stand-by y solo a quien el hotel tiene
   * asignado. Decide el servicio.
   */
  @Post(':id/transitions')
  @HttpCode(HttpStatus.OK)
  async changeState(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: WorkerEntity }> {
    return { data: await this.workers.changeState(id, dto, user) }
  }

  @Requires('recruitment', 'search_candidates')
  @Get(':id/history')
  async history(@Param('id', ParseUUIDPipe) id: string): Promise<{
    data: Array<{
      id: string
      fromState: string | null
      toState: string
      reason: string | null
      occurredAt: string
      userName: string
    }>
  }> {
    return { data: await this.workers.history(id) }
  }
}
