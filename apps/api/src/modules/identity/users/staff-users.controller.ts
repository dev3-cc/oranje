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
  Query,
} from '@nestjs/common'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { CreateStaffUserDto } from './dto/create-staff-user.dto.js'
import { QueryStaffUsersDto } from './dto/query-staff-users.dto.js'
import { UpdateStaffUserDto } from './dto/update-staff-user.dto.js'
import type { StaffUserEntity } from './entities/staff-user.entity.js'
import { Paginated, StaffUsersService } from './staff-users.service.js'

/** Personal del sistema. `users:manage` es solo del Administrador (Matriz de Ventas §CONFIGURACIÓN). */
@Controller('users')
export class StaffUsersController {
  constructor(private readonly users: StaffUsersService) {}

  @Requires('users', 'manage')
  @Get()
  list(@Query() query: QueryStaffUsersDto): Promise<Paginated<StaffUserEntity>> {
    return this.users.list(query)
  }

  @Requires('users', 'manage')
  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: StaffUserEntity }> {
    return { data: await this.users.get(id) }
  }

  @Requires('users', 'manage')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateStaffUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: StaffUserEntity }> {
    return { data: await this.users.create(dto, user) }
  }

  @Requires('users', 'manage')
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: StaffUserEntity }> {
    return { data: await this.users.update(id, dto, user) }
  }

  @Requires('users', 'manage')
  @Post(':id/resend-invitation')
  @HttpCode(HttpStatus.OK)
  async resendInvitation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: StaffUserEntity }> {
    return { data: await this.users.resendInvitation(id, user) }
  }
}
