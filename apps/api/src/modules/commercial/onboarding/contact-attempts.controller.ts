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
} from '@nestjs/common'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { ContactAttemptsService } from './contact-attempts.service.js'
import { CreateContactAttemptDto } from './dto/create-contact-attempt.dto.js'
import { UpdateContactAttemptDto } from './dto/update-contact-attempt.dto.js'
import type { AttemptSummary, ContactAttemptEntity } from './entities/contact-attempt.entity.js'

@Controller('prospects/:id/contact-attempts')
export class ContactAttemptsController {
  constructor(private readonly attempts: ContactAttemptsService) {}

  @Requires('pipeline', 'read')
  @Get()
  list(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ data: ContactAttemptEntity[]; meta: AttemptSummary }> {
    return this.attempts.list(id)
  }

  @Requires('pipeline', 'create_contact_attempt')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateContactAttemptDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ContactAttemptEntity }> {
    return { data: await this.attempts.create(id, dto, user) }
  }

  @Requires('pipeline', 'create_contact_attempt')
  @Patch(':attemptId')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() dto: UpdateContactAttemptDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ContactAttemptEntity }> {
    return { data: await this.attempts.update(id, attemptId, dto, user) }
  }

  @Requires('pipeline', 'create_contact_attempt')
  @Delete(':attemptId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.attempts.remove(id, attemptId, user)
  }
}
