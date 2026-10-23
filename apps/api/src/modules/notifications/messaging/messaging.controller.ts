import { Controller, Get } from '@nestjs/common'
import { Query } from '@nestjs/common'
import {
  BadRequestException,
  Body,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common'

import { Requires } from '../../../common/decorators/index.js'

import { CreateMessagingContactDto, UpdateMessagingContactDto } from './messaging.dto.js'
import { QueryMessagingContactsDto } from './messaging.dto.js'
import { QueryMessagingCampaignsDto } from './messaging.dto.js'
import { CreateMessagingCampaignDto } from './messaging.dto.js'
import { MessagingService } from './messaging.service.js'
import type { MessagingOverview } from './messaging.service.js'
import type { MessagingContacts } from './messaging.service.js'
import type { MessagingContact, MessagingTags } from './messaging.service.js'
import type { MessagingTemplates, TemplatesSyncResult } from './messaging.service.js'
import type { MessagingCampaigns } from './messaging.service.js'
import type { MessagingCampaign } from './messaging.service.js'

// Sin @Requires a propósito: Mensajería la ven todos los roles (Hugo,
// 2026-10-22), así que basta con tener sesión — el guard global ya la exige.
@Controller('messaging')
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get('overview')
  async overview(): Promise<{ data: MessagingOverview }> {
    return { data: await this.messaging.overview() }
  }

  @Get('contacts')
  async contacts(@Query() query: QueryMessagingContactsDto): Promise<{ data: MessagingContacts }> {
    return { data: await this.messaging.contacts(query) }
  }

  @Get('templates')
  async templates(): Promise<{ data: MessagingTemplates }> {
    return { data: await this.messaging.templates() }
  }

  @Post('templates/sync')
  @HttpCode(HttpStatus.OK)
  async syncTemplates(): Promise<{ data: TemplatesSyncResult }> {
    return { data: await this.messaging.syncTemplates() }
  }

  @Get('campaigns')
  async campaigns(
    @Query() query: QueryMessagingCampaignsDto,
  ): Promise<{ data: MessagingCampaigns }> {
    return { data: await this.messaging.campaigns(query) }
  }

  /**
   * Crear sí pide permiso: el de quien sincroniza a los colaboradores
   * (Reclutamiento, QA), que son a quienes se les escribe.
   */
  @Requires('recruitment', 'search_candidates')
  @Post('campaigns')
  @HttpCode(HttpStatus.CREATED)
  async createCampaign(
    @Body() body: CreateMessagingCampaignDto,
  ): Promise<{ data: MessagingCampaign }> {
    return {
      data: await this.messaging.createCampaign({
        name: body.name,
        description: body.description,
        templateId: body.templateId,
        variableMapping: body.variableMapping,
        recipientFilter: { mode: 'tags', tagIds: body.tagIds, matchAll: true },
      }),
    }
  }

  /* Cada acción con su ruta, como en la plataforma: así una ruta mal escrita
     es un 404 y no una acción inventada que llega hasta ella. */
  @Post('campaigns/:id/send')
  @HttpCode(HttpStatus.NO_CONTENT)
  async sendCampaign(@Param('id') id: string): Promise<void> {
    await this.messaging.campaignAction(campaignId(id), 'send')
  }

  @Post('campaigns/:id/pause')
  @HttpCode(HttpStatus.NO_CONTENT)
  async pauseCampaign(@Param('id') id: string): Promise<void> {
    await this.messaging.campaignAction(campaignId(id), 'pause')
  }

  @Post('campaigns/:id/resume')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resumeCampaign(@Param('id') id: string): Promise<void> {
    await this.messaging.campaignAction(campaignId(id), 'resume')
  }

  @Post('campaigns/:id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelCampaign(@Param('id') id: string): Promise<void> {
    await this.messaging.campaignAction(campaignId(id), 'cancel')
  }

  @Get('tags')
  async tags(): Promise<{ data: MessagingTags }> {
    return { data: await this.messaging.tags() }
  }

  @Post('contacts')
  @HttpCode(HttpStatus.CREATED)
  async createContact(
    @Body() body: CreateMessagingContactDto,
  ): Promise<{ data: MessagingContact }> {
    return { data: await this.messaging.createContact(body) }
  }

  @Patch('contacts/:id')
  async updateContact(
    @Param('id') id: string,
    @Body() body: UpdateMessagingContactDto,
  ): Promise<{ data: MessagingContact }> {
    return { data: await this.messaging.updateContact(contactId(id), body) }
  }

  @Post('contacts/:id/opt-out')
  @HttpCode(HttpStatus.OK)
  async optOutContact(@Param('id') id: string): Promise<{ data: MessagingContact }> {
    return { data: await this.messaging.optOutContact(contactId(id)) }
  }

  @Delete('contacts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteContact(@Param('id') id: string): Promise<void> {
    await this.messaging.deleteContact(contactId(id))
  }
}

/**
 * Los id de la plataforma son cuid. El id viaja dentro de la URL hacia ella:
 * nada que no sean letras y números, para que no pueda apuntar a otra ruta.
 */
function contactId(raw: string): string {
  if (!/^[A-Za-z0-9]{1,64}$/.test(raw)) {
    throw new BadRequestException({ code: 'INVALID_ID', message: 'El contacto no es válido.' })
  }
  return raw
}

/** Igual que `contactId`: el id de la campaña también viaja en la URL. */
function campaignId(raw: string): string {
  if (!/^[A-Za-z0-9]{1,64}$/.test(raw)) {
    throw new BadRequestException({ code: 'INVALID_ID', message: 'La campaña no es válida.' })
  }
  return raw
}
