import { Body, Controller, Get, Patch } from '@nestjs/common'

import { CurrentUser, Requires } from '../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../common/decorators/index.js'

import { UpdateMailSettingsDto } from './dto/update-mail-settings.dto.js'
import { MailSettingsService, type MailSettings } from './mail-settings.service.js'

/**
 * El freno de mano del correo — `settings:manage`, solo del Administrador.
 *
 * No hay permiso de solo lectura aparte: nadie más tiene por qué ver esta
 * pantalla, y partir el permiso en dos sin un rol que lo pida sería inventar.
 */
@Controller('settings/mail')
export class MailSettingsController {
  constructor(private readonly service: MailSettingsService) {}

  @Requires('settings', 'manage')
  @Get()
  async read(): Promise<{ data: MailSettings }> {
    return { data: await this.service.read() }
  }

  @Requires('settings', 'manage')
  @Patch()
  async update(
    @Body() dto: UpdateMailSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: MailSettings }> {
    return { data: await this.service.setTransport(dto.transport, user) }
  }
}
