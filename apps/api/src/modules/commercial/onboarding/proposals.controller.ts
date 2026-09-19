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

import { CreateProposalDto } from './dto/create-proposal.dto.js'
import type { ProposalEntity } from './entities/proposal.entity.js'
import { ProposalsService } from './proposals.service.js'

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
}
