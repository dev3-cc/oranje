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

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import type { CatalogItem } from '../read/catalogs.service.js'

import { CreateCatalogItemDto, UpdateCatalogItemDto } from './dto/manage-catalog.dto.js'
import { ManageCatalogsService } from './manage-catalogs.service.js'

/**
 * Escritura de catálogos — `catalogs:manage`, solo del Administrador. La
 * lectura sigue en el controller de read, abierta a toda sesión: los selects
 * de la app beben de ahí.
 */
@Controller('catalogs')
export class ManageCatalogsController {
  constructor(private readonly manage: ManageCatalogsService) {}

  @Requires('catalogs', 'manage')
  @Post(':catalog')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('catalog') catalog: string,
    @Body() dto: CreateCatalogItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: CatalogItem }> {
    this.manage.assertManaged(catalog)
    return { data: await this.manage.create(catalog, dto, user) }
  }

  @Requires('catalogs', 'manage')
  @Patch(':catalog/:id')
  async update(
    @Param('catalog') catalog: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: CatalogItem }> {
    this.manage.assertManaged(catalog)
    return { data: await this.manage.update(catalog, id, dto, user) }
  }

  @Requires('catalogs', 'manage')
  @Delete(':catalog/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('catalog') catalog: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    this.manage.assertManaged(catalog)
    await this.manage.remove(catalog, id, user)
  }
}
