import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { HoursWeekNoticeDto } from './dto/hours-week-notice.dto.js'
import { HoursWeekNoticeService, type NoticeRunResult } from './hours-week-notice.service.js'

/**
 * El correo del sábado. Lo dispara un programador (pendiente) o una persona
 * con permiso; cada llamada es segura de repetir.
 */
@Controller('hours-notices')
export class HoursWeekNoticeController {
  constructor(private readonly notices: HoursWeekNoticeService) {}

  @Requires('settings', 'manage')
  @Post('saturday')
  @HttpCode(HttpStatus.OK)
  async saturday(
    @Body() dto: HoursWeekNoticeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: NoticeRunResult }> {
    return { data: await this.notices.run(dto, user) }
  }
}
