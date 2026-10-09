import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common'

import { CurrentUser, Public, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { SchedulerTokenService } from '../../../common/security/scheduler-token.service.js'

import { AssignmentEntity, AssignmentResult, AssignmentsService } from './assignments.service.js'
import { CreateAssignmentDto } from './dto/create-assignment.dto.js'
import { ReleaseAssignmentDto } from './dto/release-assignment.dto.js'

@Controller()
export class AssignmentsController {
  constructor(
    private readonly assignments: AssignmentsService,
    private readonly schedulerTokens: SchedulerTokenService,
  ) {}

  /** Sin `@Requires`: tres permisos válidos según el rol; decide el servicio. */
  @Get('requisitions/:id/assignments')
  async list(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: AssignmentEntity[] }> {
    return { data: await this.assignments.list(id, user) }
  }

  @Requires('requisitions', 'take')
  @Post('assignments')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: AssignmentResult }> {
    return { data: await this.assignments.create(dto, user) }
  }

  /**
   * El barrido de las vencidas, para quien lo quiera disparar a mano.
   *
   * No es la única vía: al asignar se cierran primero las de esa persona, así
   * que el camino normal se cura solo. Esto sirve para ponerse al día de golpe
   * —y es el gancho por el que un programador de tareas lo correrá a diario
   * cuando se configure—.
   */
  @Requires('requisitions', 'take')
  @Post('assignments/close-expired')
  @HttpCode(HttpStatus.OK)
  async closeExpired(): Promise<{ data: { cerradas: number; fallidas: number } }> {
    return { data: await this.assignments.closeExpired() }
  }

  /**
   * El mismo barrido, pero para el programador de tareas: no hay sesión y lo
   * autentica el token OIDC de Google, igual que al consumidor de eventos.
   *
   * Ruta propia y no un `@Public()` sobre la de arriba: así la que usa una
   * persona sigue exigiendo su permiso, y la que corre sola exige su token.
   * Mezclarlas obligaría a que una sola ruta decidiera cuál de las dos
   * autenticaciones aplica, que es como se cuelan los huecos.
   */
  @Public()
  @Post('assignments/close-expired/scheduled')
  @HttpCode(HttpStatus.OK)
  async closeExpiredScheduled(
    @Headers('authorization') authorization: string | undefined,
  ): Promise<{ data: { cerradas: number; fallidas: number } }> {
    await this.schedulerTokens.verify(authorization)

    return { data: await this.assignments.closeExpired() }
  }

  @Requires('requisitions', 'take')
  @Delete('assignments/:id')
  @HttpCode(HttpStatus.OK)
  async release(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReleaseAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: AssignmentEntity }> {
    return { data: await this.assignments.release(id, dto.reason, user) }
  }
}
