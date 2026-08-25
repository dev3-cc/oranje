import { Controller, Get } from '@nestjs/common'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { MemberEntity, TeamService } from './team.service.js'

@Controller('team')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Requires('team', 'read_members')
  @Get()
  async members(@CurrentUser() user: AuthenticatedUser): Promise<{ data: MemberEntity[] }> {
    return { data: await this.team.members(user) }
  }
}
