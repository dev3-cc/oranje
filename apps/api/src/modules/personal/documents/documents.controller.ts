import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { DocumentEntity, DocumentList, DocumentsService } from './documents.service.js'
import { CreateDocumentDto } from './dto/document.dto.js'

@Controller('workers/:id/documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Requires('recruitment', 'search_candidates')
  @Get()
  list(@Param('id', ParseUUIDPipe) id: string): Promise<DocumentList> {
    return this.documents.list(id)
  }

  @Requires('recruitment', 'update_worker')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: DocumentEntity }> {
    return { data: await this.documents.create(id, dto, user) }
  }

  @Requires('recruitment', 'validate_signup')
  @Post(':documentId/verify')
  @HttpCode(HttpStatus.OK)
  async verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: DocumentEntity }> {
    return { data: await this.documents.verify(id, documentId, user) }
  }

  @Requires('recruitment', 'update_worker')
  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.documents.remove(id, documentId, user)
  }
}
