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
  UnprocessableEntityException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import type { SendMailResult } from '../../../infra/mailer/index.js'

import { CreateProposalDto } from './dto/create-proposal.dto.js'
import { SendProposalEmailDto } from './dto/send-proposal-email.dto.js'
import type { ProposalEntity } from './entities/proposal.entity.js'
import { ProposalsService } from './proposals.service.js'

/** El PDF ya es una imagen rasterizada del documento; 8 MB cubre de sobra una propuesta larga. */
const MAX_PDF_BYTES = 8 * 1024 * 1024

@Controller()
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  @Requires('proposals', 'read')
  @Get('proposals')
  async listAcross(
    @CurrentUser() user: AuthenticatedUser,
    @Query('mine') mine?: string,
    @Query('onlyDrafts') onlyDrafts?: string,
  ): Promise<{ data: Array<ProposalEntity & { prospectId: string; hotelName: string }> }> {
    return {
      data: await this.proposals.listAcross(
        mine === 'true' ? user.id : null,
        onlyDrafts === 'true',
      ),
    }
  }

  @Requires('proposals', 'read')
  @Get('prospects/:id/proposals')
  async list(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: ProposalEntity[] }> {
    return { data: await this.proposals.list(id) }
  }

  @Requires('proposals', 'create')
  @Post('prospects/:id/proposals')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateProposalDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ProposalEntity }> {
    return { data: await this.proposals.create(id, dto, user) }
  }

  @Requires('proposals', 'create')
  @Patch('prospects/:id/proposals/:proposalId')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
    @Body() dto: CreateProposalDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ProposalEntity }> {
    return { data: await this.proposals.update(id, proposalId, dto, user) }
  }

  // El mismo par que crea el borrador: quien puede abrirlo puede descartarlo.
  @Requires('proposals', 'create')
  @Delete('prospects/:id/proposals/:proposalId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async discardDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.proposals.discardDraft(id, proposalId, user)
  }

  @Requires('proposals', 'send')
  @Post('prospects/:id/proposals/:proposalId/send')
  @HttpCode(HttpStatus.OK)
  async send(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ProposalEntity }> {
    return { data: await this.proposals.send(id, proposalId, user) }
  }

  /**
   * Lo mismo que `/send` y además el correo real, con el PDF que el front ya
   * generó de la vista previa (2026-10-17) — por eso es multipart y no JSON.
   */
  @Requires('proposals', 'send')
  @Post('prospects/:id/proposals/:proposalId/send-email')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PDF_BYTES } }))
  async sendEmail(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: SendProposalEmailDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ProposalEntity; email: SendMailResult }> {
    if (!file) {
      throw new UnprocessableEntityException({
        code: 'PDF_REQUIRED',
        message: 'Falta el PDF del documento que se va a enviar',
      })
    }

    const { proposal, email } = await this.proposals.sendEmail(id, proposalId, user, {
      to: dto.to,
      note: dto.note ?? null,
      pdf: file.buffer,
    })

    return { data: proposal, email }
  }
}
