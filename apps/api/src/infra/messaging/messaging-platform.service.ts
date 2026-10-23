import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../../config/env.validation.js'

// La plataforma tarda en responder cuando su VM (e2-micro) anda corta de CPU;
// más de esto y el Panel prefiere decir que no pudo a dejar la pantalla colgada.
const TIMEOUT_MS = 10_000

// La importación da de alta contacto por contacto en la VM: con cientos de
// colaboradores tarda bastante más que una lectura.
const IMPORT_TIMEOUT_MS = 120_000

export interface PlatformImportResult {
  /** Las etiquetas que aplicó, creadas si no existían. */
  tags: string[]
  total: number
  created: number
  updated: number
  /** Filas que la plataforma descartó: sin nombre o con teléfono inválido. */
  skipped: number
}

/** Lo justo de un contacto para saber si está y si recibe campañas. */
export interface PlatformContactStatus {
  id: string
  /** E.164 sin el `+`. */
  phoneE164: string
  isActive: boolean
  tags: Array<{ tag: { id: string } }>
}

export interface PlatformPage<T> {
  data: T[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface PlatformCampaign {
  id: string
  name: string
  status: string
  sentCount: number
  totalRecipients: number
  createdAt: string
  template: { name: string } | null
}

/** Una campaña con todos sus contadores, para la sección Campañas. */
export interface PlatformCampaignRow {
  id: string
  name: string
  description: string | null
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
  template: { name: string } | null
}

/** Una variable `{{n}}`: un texto fijo o un dato de cada contacto. */
export type PlatformVariableMapping =
  { kind: 'static'; value: string } | { kind: 'contact'; field: string }

export interface PlatformCampaignInput {
  name: string
  description?: string | undefined
  templateId: string
  /** En orden: el primero es `{{1}}`. */
  variableMapping: PlatformVariableMapping[]
  /** Los contactos con TODAS estas etiquetas (y activos, sin baja: eso lo pone ella). */
  recipientFilter: { mode: 'tags'; tagIds: string[]; matchAll: true }
}

/** Lo que la plataforma deja hacer con una campaña ya creada. */
export type PlatformCampaignAction = 'send' | 'pause' | 'resume' | 'cancel'

export interface PlatformTag {
  id: string
  name: string
  color: string | null
  contactCount: number
}

export interface PlatformContact {
  id: string
  firstName: string
  lastName: string | null
  phoneE164: string
  email: string | null
  optedOut: boolean
  tags: Array<{ tag: { id: string; name: string; color: string | null } }>
}

export interface PlatformTemplate {
  id: string
  name: string
  category: string
  language: string
  status: string
  /** Los componentes tal como los manda Meta: HEADER, BODY, FOOTER, BUTTONS. */
  components: unknown
  variableCount: number
  rejectionReason: string | null
  syncedAt: string
}

export class MessagingPlatformError extends Error {}

/**
 * La plataforma rechazó la petición con un 4xx que sí es del usuario —teléfono
 * inválido, contacto duplicado, ya no existe—. Lleva su status y su mensaje,
 * que ya vienen en español, para mostrarlos tal cual.
 */
export class MessagingPlatformRejection extends MessagingPlatformError {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export interface PlatformContactInput {
  firstName?: string | undefined
  lastName?: string | null | undefined
  phone?: string | undefined
  countryCode?: string | undefined
  email?: string | null | undefined
  tagIds?: string[] | undefined
}

/**
 * Cliente de la API de meta-mensajes (Express, `<MESSAGING_API_URL>/api/*`).
 *
 * Esa API tiene su propio login con JWT: aquí se entra con una cuenta de
 * servicio y el token se guarda en memoria. Cuando caduca (o la plataforma
 * cambia su secreto) responde 401, y se vuelve a entrar una sola vez.
 */
@Injectable()
export class MessagingPlatformService {
  private readonly logger = new Logger(MessagingPlatformService.name)
  private readonly baseUrl: string | undefined
  private readonly email: string | undefined
  private readonly password: string | undefined
  private token: string | null = null

  constructor(config: ConfigService<Env, true>) {
    this.baseUrl = config.get('MESSAGING_API_URL', { infer: true })?.replace(/\/+$/, '')
    this.email = config.get('MESSAGING_API_EMAIL', { infer: true })
    this.password = config.get('MESSAGING_API_PASSWORD', { infer: true })
  }

  get enabled(): boolean {
    return this.baseUrl !== undefined && this.email !== undefined && this.password !== undefined
  }

  /** Solo se necesita el total: se pide una página de un elemento. */
  async countContacts(): Promise<number> {
    const page = await this.get<PlatformPage<unknown>>('/contacts?page=1&limit=1')
    return page.pagination.total
  }

  async listCampaigns(limit: number): Promise<PlatformPage<PlatformCampaign>> {
    return this.get<PlatformPage<PlatformCampaign>>(`/campaigns?page=1&limit=${String(limit)}`)
  }

  /** La plataforma las devuelve de la más nueva a la más vieja. */
  async listCampaignRows(query: {
    page: number
    limit: number
    status?: string | undefined
  }): Promise<PlatformPage<PlatformCampaignRow>> {
    const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) })
    if (query.status !== undefined) params.set('status', query.status)
    return this.get<PlatformPage<PlatformCampaignRow>>(`/campaigns?${params.toString()}`)
  }

  /**
   * Crea la campaña en Borrador: la plataforma cuenta ahí mismo a cuántos les
   * llegaría y rechaza (400) si las variables no son las de la plantilla.
   */
  async createCampaign(input: PlatformCampaignInput): Promise<PlatformCampaignRow> {
    const body = await this.send<{ campaign: PlatformCampaignRow }>('POST', '/campaigns', input)
    return body.campaign
  }

  /**
   * La plataforma valida el estado (solo se pausa lo que se está enviando, etc.)
   * y responde 400 con su mensaje si no se puede.
   */
  async runCampaignAction(id: string, action: PlatformCampaignAction): Promise<void> {
    await this.send<unknown>('POST', `/campaigns/${encodeURIComponent(id)}/${action}`)
  }

  /** Las plantillas sincronizadas desde Meta; la plataforma no las pagina. */
  async countTemplates(): Promise<number> {
    const body = await this.get<{ templates: unknown[] }>('/templates')
    return body.templates.length
  }

  async listTemplates(): Promise<PlatformTemplate[]> {
    const body = await this.get<{ templates: PlatformTemplate[] }>('/templates')
    return body.templates
  }

  /** Trae de Meta las plantillas de la cuenta: crea las nuevas y actualiza las demás. */
  async syncTemplates(): Promise<{ synced: number; created: number; updated: number }> {
    return this.send<{ synced: number; created: number; updated: number }>(
      'POST',
      '/templates/sync',
    )
  }

  async listTags(): Promise<PlatformTag[]> {
    const body = await this.get<{ tags: PlatformTag[] }>('/tags')
    return body.tags
  }

  /** La plataforma busca en nombre, apellido, teléfono y email. */
  async listContacts(query: {
    page: number
    limit: number
    search?: string | undefined
  }): Promise<PlatformPage<PlatformContact>> {
    const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) })
    if (query.search !== undefined && query.search !== '') params.set('search', query.search)
    return this.get<PlatformPage<PlatformContact>>(`/contacts?${params.toString()}`)
  }

  async createContact(input: PlatformContactInput): Promise<PlatformContact> {
    const body = await this.send<{ contact: PlatformContact }>('POST', '/contacts', input)
    return body.contact
  }

  /** Si viene `tagIds`, la plataforma reemplaza TODAS las etiquetas del contacto. */
  async updateContact(id: string, input: PlatformContactInput): Promise<PlatformContact> {
    const body = await this.send<{ contact: PlatformContact }>(
      'PATCH',
      `/contacts/${encodeURIComponent(id)}`,
      input,
    )
    return body.contact
  }

  async optOutContact(id: string): Promise<PlatformContact> {
    const body = await this.send<{ contact: PlatformContact }>(
      'POST',
      `/contacts/${encodeURIComponent(id)}/opt-out`,
    )
    return body.contact
  }

  async deleteContact(id: string): Promise<void> {
    await this.send<null>('DELETE', `/contacts/${encodeURIComponent(id)}`)
  }

  /** El id de una etiqueta por su nombre; null si todavía no existe. */
  async findTagId(name: string): Promise<string | null> {
    const tags = await this.listTags()
    return tags.find((tag) => tag.name === name)?.id ?? null
  }

  /** Todos los contactos de una etiqueta, activos o no, de cien en cien. */
  async listTaggedContacts(tagId: string): Promise<PlatformContactStatus[]> {
    const contacts: PlatformContactStatus[] = []
    for (let page = 1; ; page += 1) {
      const params = new URLSearchParams({ page: String(page), limit: '100', tag: tagId })
      const body = await this.get<PlatformPage<PlatformContactStatus>>(
        `/contacts?${params.toString()}`,
      )
      contacts.push(...body.data)
      if (page >= body.pagination.totalPages || body.data.length === 0) return contacts
    }
  }

  /** El id de una etiqueta por su nombre; la crea si todavía no existe. */
  async ensureTagId(name: string): Promise<string> {
    const existing = await this.findTagId(name)
    if (existing !== null) return existing
    const body = await this.send<{ tag: { id: string } }>('POST', '/tags', { name })
    return body.tag.id
  }

  /**
   * Un contacto inactivo queda fuera de toda campaña; a diferencia de la baja,
   * se revierte. `tagIds` reemplaza TODAS sus etiquetas: hay que mandar las que
   * ya tenía.
   */
  async setContactActive(id: string, isActive: boolean, tagIds: string[]): Promise<void> {
    await this.send<unknown>('PATCH', `/contacts/${encodeURIComponent(id)}`, { isActive, tagIds })
  }

  /**
   * La importación masiva de la plataforma: un CSV en una sola llamada. Crea o
   * actualiza cada contacto por teléfono, crea las etiquetas por nombre y le
   * pone `tagName` a todos. Las etiquetas se SUMAN: no quita las que ya tenía.
   */
  async importContacts(csv: string, tagName: string): Promise<PlatformImportResult> {
    const call = async (): Promise<Response> => {
      const form = new FormData()
      form.append('file', new Blob([csv], { type: 'text/csv' }), 'colaboradores.csv')
      form.append('tagName', tagName)
      const token = this.token ?? (await this.login())
      return this.requestImport(token, form)
    }

    let response = await call()
    if (response.status === 401) {
      this.token = null
      response = await call()
    }

    if (response.status >= 400 && response.status < 500) {
      const error = (await response.json().catch(() => null)) as {
        error?: { message?: string }
      } | null
      this.logger.warn(
        `La plataforma de mensajería rechazó la importación: HTTP ${response.status}`,
      )
      throw new MessagingPlatformRejection(
        response.status,
        error?.error?.message ??
          `La plataforma de mensajería rechazó la importación (HTTP ${String(response.status)}).`,
      )
    }

    return this.parse<PlatformImportResult>('/contacts/import', response)
  }

  /**
   * Las escrituras. Como `get`, reintenta una vez si el token caducó; a
   * diferencia de `get`, un 4xx no es una falla de la plataforma sino una
   * respuesta para el usuario, y sale como `MessagingPlatformRejection`.
   */
  private async send<T>(
    method: 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const call = async (): Promise<Response> => {
      const token = this.token ?? (await this.login())
      return this.request(path, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    }

    let response = await call()
    if (response.status === 401) {
      this.token = null
      response = await call()
    }

    if (response.status === 204) return null as T

    if (response.status >= 400 && response.status < 500) {
      const error = (await response.json().catch(() => null)) as {
        error?: { message?: string }
      } | null
      this.logger.warn(
        `La plataforma de mensajería rechazó ${method} ${path}: HTTP ${response.status}`,
      )
      throw new MessagingPlatformRejection(
        response.status,
        error?.error?.message ??
          `La plataforma de mensajería rechazó la operación (HTTP ${String(response.status)}).`,
      )
    }

    return this.parse<T>(path, response)
  }

  private async get<T>(path: string): Promise<T> {
    const response = await this.authorizedFetch(path)

    if (response.status === 401) {
      // El token se venció o lo invalidaron: uno nuevo y un solo reintento.
      this.token = null
      return this.parse<T>(path, await this.authorizedFetch(path))
    }

    return this.parse<T>(path, response)
  }

  private async authorizedFetch(path: string): Promise<Response> {
    const token = this.token ?? (await this.login())
    return this.request(path, { headers: { Authorization: `Bearer ${token}` } })
  }

  private async login(): Promise<string> {
    const response = await this.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.email, password: this.password }),
    })

    if (!response.ok) {
      this.logger.warn(`La plataforma de mensajería rechazó el login: HTTP ${response.status}`)
      throw new MessagingPlatformError(
        'La plataforma de mensajería no aceptó la cuenta de servicio de Oranje.',
      )
    }

    const body = (await response.json()) as { token: string }
    this.token = body.token
    return body.token
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    if (!this.enabled) {
      throw new MessagingPlatformError(
        'La plataforma de mensajería no está configurada (faltan MESSAGING_API_*).',
      )
    }

    try {
      return await fetch(`${this.baseUrl}/api${path}`, {
        ...init,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (error) {
      this.logger.warn(`La plataforma de mensajería no respondió a ${path}: ${String(error)}`)
      throw new MessagingPlatformError('La plataforma de mensajería no respondió.')
    }
  }

  /** Como `request`, con el plazo largo de la importación. */
  private async requestImport(token: string, form: FormData): Promise<Response> {
    if (!this.enabled) {
      throw new MessagingPlatformError(
        'La plataforma de mensajería no está configurada (faltan MESSAGING_API_*).',
      )
    }

    try {
      return await fetch(`${this.baseUrl}/api/contacts/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        signal: AbortSignal.timeout(IMPORT_TIMEOUT_MS),
      })
    } catch (error) {
      this.logger.warn(
        `La plataforma de mensajería no respondió a la importación: ${String(error)}`,
      )
      throw new MessagingPlatformError('La plataforma de mensajería no respondió.')
    }
  }

  private async parse<T>(path: string, response: Response): Promise<T> {
    if (!response.ok) {
      this.logger.warn(`La plataforma de mensajería respondió HTTP ${response.status} a ${path}`)
      throw new MessagingPlatformError(
        `La plataforma de mensajería respondió HTTP ${String(response.status)}.`,
      )
    }
    return (await response.json()) as T
  }
}
