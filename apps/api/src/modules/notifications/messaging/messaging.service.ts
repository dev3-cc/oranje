import { BadGatewayException, Injectable } from '@nestjs/common'
import { HttpException, ServiceUnavailableException } from '@nestjs/common'

import { MessagingPlatformError, MessagingPlatformService } from '../../../infra/messaging/index.js'
import { MessagingPlatformRejection } from '../../../infra/messaging/index.js'
import type { PlatformContact, PlatformContactInput } from '../../../infra/messaging/index.js'
import type { PlatformTemplate } from '../../../infra/messaging/index.js'
import type { PlatformCampaignAction, PlatformCampaignRow } from '../../../infra/messaging/index.js'
import type { PlatformCampaignInput } from '../../../infra/messaging/index.js'

/** Las mismas cinco que muestra el Panel de la plataforma de mensajería. */
const RECENT_CAMPAIGNS = 5

export interface RecentCampaign {
  id: string
  name: string
  templateName: string | null
  status: string
  sentCount: number
  totalRecipients: number
  createdAt: string
}

export type MessagingOverview =
  | { configured: false }
  | {
      configured: true
      contacts: number
      templates: number
      campaigns: number
      recentCampaigns: RecentCampaign[]
    }

export interface MessagingContact {
  id: string
  firstName: string
  lastName: string | null
  /** E.164 sin el `+`, como lo guarda la plataforma. */
  phone: string
  email: string | null
  optedOut: boolean
  tags: Array<{ id: string; name: string; color: string | null }>
}

export type MessagingContacts =
  | { configured: false }
  | {
      configured: true
      contacts: MessagingContact[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }

export interface MessagingTag {
  id: string
  name: string
  color: string | null
  contactCount: number
}

export type MessagingTags = { configured: false } | { configured: true; tags: MessagingTag[] }

export interface MessagingTemplate {
  id: string
  name: string
  /** MARKETING | UTILITY | AUTHENTICATION, como los clasifica Meta. */
  category: string
  language: string
  /** PENDING | APPROVED | REJECTED | PAUSED | DISABLED. */
  status: string
  variableCount: number
  /** El texto del mensaje (componente BODY), con sus `{{1}}`; null si no trae. */
  body: string | null
  rejectionReason: string | null
  syncedAt: string
}

export type MessagingTemplates =
  { configured: false } | { configured: true; templates: MessagingTemplate[] }

export interface TemplatesSyncResult {
  synced: number
  created: number
  updated: number
}

export interface MessagingCampaign {
  id: string
  name: string
  description: string | null
  templateName: string | null
  /** DRAFT | SCHEDULED | SENDING | COMPLETED | PAUSED | FAILED | CANCELLED. */
  status: string
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  readCount: number
  failedCount: number
  scheduledAt: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

export type MessagingCampaigns =
  | { configured: false }
  | {
      configured: true
      campaigns: MessagingCampaign[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }

/**
 * El Panel de Mensajería: lo mismo que el Panel de meta-mensajes —contactos,
 * plantillas y campañas— (Hugo, 2026-10-23: volvió a plantillas).
 */
@Injectable()
export class MessagingService {
  constructor(private readonly platform: MessagingPlatformService) {}

  async overview(): Promise<MessagingOverview> {
    if (!this.platform.enabled) return { configured: false }

    try {
      const [contacts, templates, campaigns] = await Promise.all([
        this.platform.countContacts(),
        this.platform.countTemplates(),
        this.platform.listCampaigns(RECENT_CAMPAIGNS),
      ])

      return {
        configured: true,
        contacts,
        templates,
        campaigns: campaigns.pagination.total,
        recentCampaigns: campaigns.data.map((campaign) => ({
          id: campaign.id,
          name: campaign.name,
          templateName: campaign.template?.name ?? null,
          status: campaign.status,
          sentCount: campaign.sentCount,
          totalRecipients: campaign.totalRecipients,
          createdAt: campaign.createdAt,
        })),
      }
    } catch (error) {
      if (error instanceof MessagingPlatformError) {
        throw new BadGatewayException({ code: 'MESSAGING_PLATFORM_ERROR', message: error.message })
      }
      throw error
    }
  }

  /** La lista de Contactos de la plataforma; las escrituras van más abajo. */
  async contacts(query: {
    page: number
    limit: number
    search?: string | undefined
  }): Promise<MessagingContacts> {
    if (!this.platform.enabled) return { configured: false }

    try {
      const page = await this.platform.listContacts(query)

      return {
        configured: true,
        contacts: page.data.map((contact) => ({
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          phone: contact.phoneE164,
          email: contact.email,
          optedOut: contact.optedOut,
          tags: contact.tags.map(({ tag }) => tag),
        })),
        pagination: page.pagination,
      }
    } catch (error) {
      if (error instanceof MessagingPlatformError) {
        throw new BadGatewayException({ code: 'MESSAGING_PLATFORM_ERROR', message: error.message })
      }
      throw error
    }
  }

  /** Las etiquetas, para elegirlas al crear o editar un contacto. */
  async tags(): Promise<MessagingTags> {
    if (!this.platform.enabled) return { configured: false }

    try {
      const tags = await this.platform.listTags()
      return {
        configured: true,
        tags: tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          contactCount: tag.contactCount,
        })),
      }
    } catch (error) {
      throw this.toHttpError(error)
    }
  }

  async createContact(input: PlatformContactInput): Promise<MessagingContact> {
    return this.write(async () => this.platform.createContact(input))
  }

  async updateContact(id: string, input: PlatformContactInput): Promise<MessagingContact> {
    return this.write(async () => this.platform.updateContact(id, input))
  }

  /** La baja es de compliance: la plataforma no le vuelve a escribir. */
  async optOutContact(id: string): Promise<MessagingContact> {
    return this.write(async () => this.platform.optOutContact(id))
  }

  async deleteContact(id: string): Promise<void> {
    this.assertWritable()
    try {
      await this.platform.deleteContact(id)
    } catch (error) {
      throw this.toHttpError(error)
    }
  }

  /** Las plantillas que la plataforma ya trajo de Meta, las más recientes primero. */
  async templates(): Promise<MessagingTemplates> {
    if (!this.platform.enabled) return { configured: false }

    try {
      const templates = await this.platform.listTemplates()
      return { configured: true, templates: templates.map(toMessagingTemplate) }
    } catch (error) {
      throw this.toHttpError(error)
    }
  }

  /**
   * Pide a la plataforma que traiga las plantillas de Meta. Sin credenciales de
   * Meta en la plataforma responde 400 con su mensaje, y se muestra tal cual.
   */
  async syncTemplates(): Promise<TemplatesSyncResult> {
    this.assertWritable()
    try {
      return await this.platform.syncTemplates()
    } catch (error) {
      throw this.toHttpError(error)
    }
  }

  async campaigns(query: {
    page: number
    limit: number
    status?: string | undefined
  }): Promise<MessagingCampaigns> {
    if (!this.platform.enabled) return { configured: false }

    try {
      const page = await this.platform.listCampaignRows(query)
      return {
        configured: true,
        campaigns: page.data.map(toMessagingCampaign),
        pagination: page.pagination,
      }
    } catch (error) {
      throw this.toHttpError(error)
    }
  }

  /** La campaña nace en Borrador: enviarla es otra acción, con su confirmación. */
  async createCampaign(input: PlatformCampaignInput): Promise<MessagingCampaign> {
    this.assertWritable()
    try {
      return toMessagingCampaign(await this.platform.createCampaign(input))
    } catch (error) {
      throw this.toHttpError(error)
    }
  }

  /**
   * Enviar, pausar, reanudar o cancelar. Si el estado no lo permite, la
   * plataforma responde 400 con su mensaje y sale tal cual.
   */
  async campaignAction(id: string, action: PlatformCampaignAction): Promise<void> {
    this.assertWritable()
    try {
      await this.platform.runCampaignAction(id, action)
    } catch (error) {
      throw this.toHttpError(error)
    }
  }

  private async write(run: () => Promise<PlatformContact>): Promise<MessagingContact> {
    this.assertWritable()
    try {
      return toMessagingContact(await run())
    } catch (error) {
      throw this.toHttpError(error)
    }
  }

  /** Leer sin plataforma es «no configurado»; escribir sin ella, un 503. */
  private assertWritable(): void {
    if (!this.platform.enabled) {
      throw new ServiceUnavailableException({
        code: 'MESSAGING_NOT_CONFIGURED',
        message: 'Este ambiente no está conectado a la plataforma de mensajería.',
      })
    }
  }

  /**
   * Un 4xx de la plataforma es para la persona (teléfono inválido, duplicado,
   * ya no existe) y sale con su status y su mensaje. Un 401/403 ya no es de
   * ella: es la cuenta de servicio de Oranje, y cuenta como falla (502).
   */
  private toHttpError(error: unknown): unknown {
    if (
      error instanceof MessagingPlatformRejection &&
      error.status !== 401 &&
      error.status !== 403
    ) {
      return new HttpException(
        { code: 'MESSAGING_PLATFORM_REJECTED', message: error.message },
        error.status,
      )
    }
    if (error instanceof MessagingPlatformError) {
      return new BadGatewayException({ code: 'MESSAGING_PLATFORM_ERROR', message: error.message })
    }
    return error
  }
}

function toMessagingTemplate(template: PlatformTemplate): MessagingTemplate {
  return {
    id: template.id,
    name: template.name,
    category: template.category,
    language: template.language,
    status: template.status,
    variableCount: template.variableCount,
    body: bodyText(template.components),
    rejectionReason: template.rejectionReason,
    syncedAt: template.syncedAt,
  }
}

/** El texto del componente BODY de Meta. Los componentes llegan sin tipar. */
function bodyText(components: unknown): string | null {
  if (!Array.isArray(components)) return null
  for (const component of components as Array<{ type?: unknown; text?: unknown }>) {
    if (component.type === 'BODY' && typeof component.text === 'string') return component.text
  }
  return null
}

function toMessagingContact(contact: PlatformContact): MessagingContact {
  return {
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    phone: contact.phoneE164,
    email: contact.email,
    optedOut: contact.optedOut,
    tags: contact.tags.map(({ tag }) => tag),
  }
}

function toMessagingCampaign(campaign: PlatformCampaignRow): MessagingCampaign {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    templateName: campaign.template?.name ?? null,
    status: campaign.status,
    totalRecipients: campaign.totalRecipients,
    sentCount: campaign.sentCount,
    deliveredCount: campaign.deliveredCount,
    readCount: campaign.readCount,
    failedCount: campaign.failedCount,
    scheduledAt: campaign.scheduledAt,
    startedAt: campaign.startedAt,
    completedAt: campaign.completedAt,
    createdAt: campaign.createdAt,
  }
}
