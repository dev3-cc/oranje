import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { CreateRequisitionDto, DeleteRequisitionDto } from './dto/create-requisition.dto.js'
import { QueryRequisitionsDto } from './dto/query-requisitions.dto.js'
import type { RequisitionEntity } from './entities/requisition.entity.js'
import { RequisitionBoard, RequisitionsService } from './requisitions.service.js'

@Controller('requisitions')
export class RequisitionsController {
  constructor(private readonly requisitions: RequisitionsService) {}

  /**
   * Sin `@Requires`: leer requisiciones tiene TRES permisos válidos según el
   * rol (`read_own` del Hotel, `read_all` y `read_authorized_queue` de
   * Reclutamiento) y el decorador solo sabe exigir un par. El servicio decide
   * cuál aplica y con qué alcance — mismo patrón que el territorio.
   */
  @Get()
  list(
    @Query() query: QueryRequisitionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequisitionBoard> {
    return this.requisitions.list(query, user)
  }

  @Get(':id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: RequisitionEntity }> {
    return { data: await this.requisitions.get(id, user) }
  }

  @Requires('requisitions', 'create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateRequisitionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: RequisitionEntity }> {
    return { data: await this.requisitions.create(dto, user) }
  }

  /**
   * Eliminar es pasar a Morado, no borrar la fila — por eso es POST y no
   * DELETE: el recurso sigue existiendo y `GET /:id` lo sigue sirviendo.
   *
   * Sin `@Requires`: quien puede lo dice la tabla de transiciones, y el
   * borrador además solo lo quita su creador. La Matriz no tiene un par para
   * esto, y el semáforo sí.
   */
  @Post(':id/delete')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeleteRequisitionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: RequisitionEntity }> {
    return { data: await this.requisitions.remove(id, dto.reason ?? null, user) }
  }

  @Requires('requisitions', 'authorize')
  @Post(':id/authorize')
  @HttpCode(HttpStatus.OK)
  async authorize(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: RequisitionEntity }> {
    return { data: await this.requisitions.authorize(id, user) }
  }
}
