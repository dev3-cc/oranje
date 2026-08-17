import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { ContactAttemptsService } from './contact-attempts.service.js'
import { CreateContactAttemptDto } from './dto/create-contact-attempt.dto.js'
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
}
