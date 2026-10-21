import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common'
import { z } from 'zod'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { createZodDto } from '../../../common/pipes/index.js'
import { PermissionsService } from '../auth/permissions.service.js'

import {
  HotelTeamMemberEntity,
  MemberEntity,
  RecruitmentMemberEntity,
  TeamService,
} from './team.service.js'

class MoveRecruiterDto extends createZodDto(z.object({ reportsToUserId: z.uuid() }).strict()) {}

@Controller('team')
export class TeamController {
  constructor(
    private readonly team: TeamService,
    private readonly permissions: PermissionsService,
  ) {}

  @Requires('team', 'read_members')
  @Get()
  async members(@CurrentUser() user: AuthenticatedUser): Promise<{ data: MemberEntity[] }> {
    return { data: await this.team.members(user) }
  }

  /** El equipo de la Manager de Reclutamiento: sus Líderes y sus Reclutadoras, con su carga. */
  @Requires('team', 'read_members')
  @Get('recruitment')
  async recruitment(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: RecruitmentMemberEntity[] }> {
    return { data: await this.team.recruitmentTeam(user) }
  }

  /**
   * El equipo del Manager General (Mi Equipo del Hotel). Los Supervisores son
   * otro permiso (`hotel_team:read_supervisors`) y `@Requires` solo sabe de un
   * par, así que ese se resuelve aquí.
   */
  @Requires('hotel_team', 'read_managers')
  @Get('hotel')
  async hotel(@CurrentUser() user: AuthenticatedUser): Promise<{ data: HotelTeamMemberEntity[] }> {
    const withSupervisors = await this.permissions.can(
      user.roleCode,
      'hotel_team',
      'read_supervisors',
    )
    return { data: await this.team.hotelTeam(user, withSupervisors) }
  }

  @Requires('team', 'move_member')
  @Patch('members/:id/reports-to')
  async moveRecruiter(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveRecruiterDto,
  ): Promise<{ data: { id: string; reportsToUserId: string } }> {
    return { data: await this.team.moveRecruiter(user, id, dto.reportsToUserId) }
  }
}
