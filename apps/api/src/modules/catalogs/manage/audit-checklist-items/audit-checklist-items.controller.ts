import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common'

import { CurrentUser, Requires } from '../../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../../common/decorators/index.js'

import { AuditChecklistItem, AuditChecklistItemsService } from './audit-checklist-items.service.js'
import {
  CreateAuditChecklistItemDto,
  UpdateAuditChecklistItemDto,
} from './dto/audit-checklist-item.dto.js'

/**
 * Escritura del catálogo de reactivos — `catalogs:manage`, solo del
 * Administrador. Mismo permiso y mismo prefijo de ruta que el CRUD genérico de
 * catálogos, con su propio contrato de campos (ver el service para el porqué
 * de no meterlo al switch genérico). La lectura vive en
 * `GET /catalogs/audit-checklist-items` (catalogs/read), abierta como el
 * resto de catálogos.
 */
@Controller('catalogs/audit-checklist-items')
export class AuditChecklistItemsController {
  constructor(private readonly items: AuditChecklistItemsService) {}

  @Requires('catalogs', 'manage')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateAuditChecklistItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: AuditChecklistItem }> {
    return { data: await this.items.create(dto, user) }
  }

  @Requires('catalogs', 'manage')
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAuditChecklistItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: AuditChecklistItem }> {
    return { data: await this.items.update(id, dto, user) }
  }

  @Requires('catalogs', 'manage')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.items.remove(id, user)
  }
}
