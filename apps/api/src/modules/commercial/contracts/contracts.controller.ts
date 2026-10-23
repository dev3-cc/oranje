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
  Put,
  Query,
  UnprocessableEntityException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import type { SendMailResult } from '../../../infra/mailer/index.js'

import { ContractEntity, ContractsService } from './contracts.service.js'
import {
  CreateContractDto,
  SendContractEmailDto,
  UnlockContractDto,
  UpdateContractDto,
  UpsertRateDto,
} from './dto/contract.dto.js'

/** El PDF ya es una imagen rasterizada del documento; 8 MB cubre de sobra un contrato largo. */
const MAX_PDF_BYTES = 8 * 1024 * 1024

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Requires('terms_and_conditions', 'read')
  @Get()
  async list(
    @Query('hotelId') hotelId?: string,
    @Query('status') status?: string,
  ): Promise<{ data: ContractEntity[] }> {
    return { data: await this.contracts.list(hotelId, status) }
  }

  /**
   * Antes de `:id` a propósito: si no, Nest la toma como el parámetro y
   * `ParseUUIDPipe` la rechaza. Un permiso propio (`requisitions:read_position_pay`)
   * en vez de `terms_and_conditions:read`: Reclutamiento no ve el contrato
   * completo, solo el pago de la posición que va a asignar.
   */
  @Requires('requisitions', 'read_position_pay')
  @Get('position-rate')
  async positionRate(
    @Query('hotelId', ParseUUIDPipe) hotelId: string,
    @Query('catalogPositionId', ParseUUIDPipe) catalogPositionId: string,
  ): Promise<{ data: { payRate: string; contractNumber: string } | null }> {
    return { data: await this.contracts.positionPayRate(hotelId, catalogPositionId) }
  }

  @Requires('terms_and_conditions', 'read')
  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: ContractEntity }> {
    return { data: await this.contracts.get(id) }
  }

  @Requires('terms_and_conditions', 'create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ContractEntity }> {
    return { data: await this.contracts.create(dto, user) }
  }

  @Requires('terms_and_conditions', 'update')
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ContractEntity }> {
    return { data: await this.contracts.update(id, dto, user) }
  }

  @Requires('terms_and_conditions', 'update')
  @Put(':id/rates')
  @HttpCode(HttpStatus.OK)
  async setRate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertRateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ContractEntity }> {
    return { data: await this.contracts.setRate(id, dto, user) }
  }

  @Requires('terms_and_conditions', 'approve')
  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ContractEntity }> {
    return { data: await this.contracts.activate(id, user) }
  }

  @Requires('terms_and_conditions', 'approve')
  @Post(':id/expire')
  @HttpCode(HttpStatus.OK)
  async expire(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ContractEntity }> {
    return { data: await this.contracts.close(id, true, user) }
  }

  @Requires('terms_and_conditions', 'approve')
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ContractEntity }> {
    return { data: await this.contracts.close(id, false, user) }
  }

  /** Mismo rol que activa/aprueba (Hugo, 2026-10-21): no es un permiso nuevo. */
  @Requires('terms_and_conditions', 'approve')
  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  async unlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UnlockContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ContractEntity }> {
    return { data: await this.contracts.setLock(id, true, dto.reason, user) }
  }

  @Requires('terms_and_conditions', 'approve')
  @Post(':id/lock')
  @HttpCode(HttpStatus.OK)
  async lock(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ContractEntity }> {
    return { data: await this.contracts.setLock(id, false, null, user) }
  }

  /**
   * «Marcar como enviado» (2026-10-23): el contrato llegó al hotel por fuera.
   * Mismo permiso que editarlo, porque enviar es lo que lo congela.
   */
  /** El borrador toma las tarifas de la última propuesta enviada (2026-10-23). */
  @Requires('terms_and_conditions', 'update')
  @Post(':id/sync-proposal')
  @HttpCode(HttpStatus.OK)
  async syncProposal(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ContractEntity }> {
    return { data: await this.contracts.syncFromProposal(id, user) }
  }

  @Requires('terms_and_conditions', 'update')
  @Post(':id/mark-sent')
  @HttpCode(HttpStatus.OK)
  async markSent(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ContractEntity }> {
    return { data: await this.contracts.markSent(id, user) }
  }

  /**
   * Manda el acuerdo por correo con el PDF adjunto (2026-10-17). Si el
   * borrador no se había enviado, lo deja enviado y bloqueado (2026-10-23):
   * por eso pide el permiso de editar y no solo el de leer.
   */
  @Requires('terms_and_conditions', 'update')
  @Post(':id/send-email')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PDF_BYTES } }))
  async sendEmail(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: SendContractEmailDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ email: SendMailResult }> {
    if (!file) {
      throw new UnprocessableEntityException({
        code: 'PDF_REQUIRED',
        message: 'Falta el PDF del documento que se va a enviar',
      })
    }

    const email = await this.contracts.sendEmail(id, user, {
      to: dto.to,
      note: dto.note ?? null,
      pdf: file.buffer,
    })

    return { email }
  }
}
