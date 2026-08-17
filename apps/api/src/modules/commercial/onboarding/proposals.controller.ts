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
} from '@nestjs/common'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { CreateProposalDto } from './dto/create-proposal.dto.js'
import type { ProposalEntity } from './entities/proposal.entity.js'
import { ProposalsService } from './proposals.service.js'

@Controller('prospects/:id/proposals')
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  @Requires('proposals', 'read')
  @Get()
  async list(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: ProposalEntity[] }> {
    return { data: await this.proposals.list(id) }
  }

  @Requires('proposals', 'create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateProposalDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ProposalEntity }> {
    return { data: await this.proposals.create(id, dto, user) }
  }

  @Requires('proposals', 'create')
  @Patch(':proposalId')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
    @Body() dto: CreateProposalDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ProposalEntity }> {
    return { data: await this.proposals.update(id, proposalId, dto, user) }
  }

  @Requires('proposals', 'send')
  @Post(':proposalId/send')
  async send(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ProposalEntity }> {
    return { data: await this.proposals.send(id, proposalId, user) }
  }
}
