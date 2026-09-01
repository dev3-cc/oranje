import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common'

import { AllowWhenOverdue, CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import type { DocumentEntity } from '../documents/documents.service.js'
import type { WorkerEntity } from '../workers/entities/worker.entity.js'

import { CompleteSignupDto, UpdateOwnContactDto, UploadOwnDocumentDto } from './dto/me.dto.js'
import { MeService } from './me.service.js'
import type { TaxDeadline } from './tax-deadline.service.js'

@Controller('workers/me')
export class MeController {
  constructor(private readonly me: MeService) {}

  // Abierto con el acceso suspendido: la persona tiene que poder VER por qué
  // está fuera. La ficha ya trae `taxDeadline` con el motivo.
  @AllowWhenOverdue()
  @Requires('worker', 'read_own')
  @Get()
  async get(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: WorkerEntity & { taxDeadline: TaxDeadline } }> {
    return { data: await this.me.get(user) }
  }

  @Requires('worker', 'read_own')
  @Get('history')
  async history(@CurrentUser() user: AuthenticatedUser): Promise<{
    data: Array<{
      id: string
      fromState: string | null
      toState: string
      reason: string | null
      occurredAt: string
      userName: string
    }>
  }> {
    return { data: await this.me.history(user) }
  }

  // Sube su SSN/ITIN (RF-C-01). Es lo que corre el plazo de D-33, y por eso va
  // abierto aun con el acceso suspendido: si no, la única salida está detrás de
  // la puerta que cerró.
  @AllowWhenOverdue()
  @Requires('worker', 'complete_signup')
  @Post('documents')
  @HttpCode(HttpStatus.CREATED)
  async uploadDocument(
    @Body() dto: UploadOwnDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: DocumentEntity }> {
    return { data: await this.me.uploadDocument(dto, user) }
  }

  @Requires('worker', 'complete_signup')
  @Patch('signup')
  async completeSignup(
    @Body() dto: CompleteSignupDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: WorkerEntity }> {
    return { data: await this.me.completeSignup(dto, user) }
  }

  @Requires('worker', 'update_own_contact')
  @Patch()
  async updateContact(
    @Body() dto: UpdateOwnContactDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: WorkerEntity }> {
    return { data: await this.me.updateContact(dto, user) }
  }

  // Solo activa. La vuelta a Verde fuerte NO tiene transición en el Semáforo
  // del Colaborador —solo la menciona `04 - Permisos Detallados`—, así que no
  // se inventa aquí.
  @Requires('worker', 'set_availability')
  @Post('availability')
  @HttpCode(HttpStatus.OK)
  async setAvailable(@CurrentUser() user: AuthenticatedUser): Promise<{ data: WorkerEntity }> {
    return { data: await this.me.setAvailable(user) }
  }
}
