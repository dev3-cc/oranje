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

import { AssignmentEntity, AssignmentResult, AssignmentsService } from './assignments.service.js'
import { CreateAssignmentDto } from './dto/create-assignment.dto.js'
import { ReleaseAssignmentDto } from './dto/release-assignment.dto.js'

@Controller()
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Requires('requisitions', 'read_own')
  @Get('requisitions/:id/assignments')
  async list(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: AssignmentEntity[] }> {
    return { data: await this.assignments.list(id) }
  }

  @Requires('requisitions', 'take')
  @Post('assignments')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: AssignmentResult }> {
    return { data: await this.assignments.create(dto, user) }
  }

  @Requires('requisitions', 'take')
  @Delete('assignments/:id')
  @HttpCode(HttpStatus.OK)
  async release(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReleaseAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: AssignmentEntity }> {
    return { data: await this.assignments.release(id, dto.reason, user) }
  }
}
