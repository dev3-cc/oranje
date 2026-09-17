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

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { AssignmentsService } from '../../coverage/assignments/assignments.service.js'
import { CorporateEmailService } from '../../identity/users/corporate-email.service.js'

import {
  ChangeStateDto,
  CreateWorkerAccessDto,
  CreateWorkerDto,
  QueryWorkersDto,
  UpdateWorkerDto,
} from './dto/create-worker.dto.js'
import type { WorkerEntity } from './entities/worker.entity.js'
import { WorkerAccessService } from './worker-access.service.js'
import type { WorkerAccessCredential } from './worker-access.service.js'
import { TransitionOption, WorkerBoard, WorkersService } from './workers.service.js'

@Controller('workers')
export class WorkersController {
  constructor(
    private readonly workers: WorkersService,
    private readonly access: WorkerAccessService,
    private readonly corporateEmail: CorporateEmailService,
    private readonly assignments: AssignmentsService,
  ) {}

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

  /* Antes de `:id`: con ParseUUIDPipe, «access-domain» caería como id inválido. */
  /** El dominio del buzón, para que el front proponga `inicial+apellido@…` sin adivinarlo. */
  @Requires('recruitment', 'update_worker')
  @Get('access-domain')
  accessDomain(): { data: { domain: string } } {
    return { data: { domain: this.access.domainName } }
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

  /**
   * El acceso del colaborador (cuenta de Oranje + buzón corporativo) con la
   * contraseña temporal que se muestra una sola vez. Es parte del alta, así
   * que lo cubre el mismo permiso que editar el expediente.
   */
  @Requires('recruitment', 'update_worker')
  @Post(':id/access')
  @HttpCode(HttpStatus.CREATED)
  async createAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateWorkerAccessDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: WorkerAccessCredential }> {
    return { data: await this.access.create(id, dto.localPart, user) }
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

  /**
   * Solo el rol que ve el Pool y sus jefes (Reclutamiento). Sí se puede
   * eliminar aunque siga trabajando (Hugo, 2026-09-15): primero se libera
   * cada asignación ACTIVA suya —la misma acción que soltarlo a mano, así que
   * la cobertura del slot se recalcula igual— y si tiene correo corporativo,
   * se borra también su buzón en cPanel. Los dos son mejor esfuerzo: si
   * cPanel no responde, el colaborador igual queda eliminado.
   */
  @Requires('recruitment', 'delete_worker')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.assignments.releaseAllOf(id, 'Colaborador eliminado del Pool', user)

    // Antes de eliminar: una vez que `deleted_at` se escribe, el colaborador
    // deja de existir para `corporateEmailOf` y ya no se le podría encontrar
    // el correo que hay que borrar.
    try {
      await this.corporateEmail.deleteMailbox(id)
    } catch {
      // Sin correo corporativo (lo normal) o cPanel no respondió: no bloquea
      // eliminar al colaborador.
    }

    await this.workers.delete(id, user)
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
