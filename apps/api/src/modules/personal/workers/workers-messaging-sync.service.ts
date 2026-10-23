import { BadGatewayException, HttpException, Injectable } from '@nestjs/common'
import { ServiceUnavailableException } from '@nestjs/common'
import { parsePhoneNumberFromString } from 'libphonenumber-js'

import { MessagingPlatformError, MessagingPlatformService } from '../../../infra/messaging/index.js'
import { MessagingPlatformRejection } from '../../../infra/messaging/index.js'

import { WorkerRow, WorkersRepository } from './workers.repository.js'

/** La etiqueta que la plataforma le pone a todos los que llegan de Oranje. */
export const ORANJE_TAG = 'Oranje'

/** La marca de quien desactivó Oranje por la lista negra: solo a esos se reactiva. */
export const BLACKLIST_TAG = 'Oranje: lista negra'

/* Las etiquetas que Oranje mantiene al día; cualquier otra es de quien use la plataforma. */
const STATE_PREFIX = 'Estado: '
const HOTEL_PREFIX = 'Hotel: '

/** El tope de `findMany`: el Pool se recorre de cien en cien. */
const PAGE_SIZE = 100

export interface WorkersMessagingSyncResult {
  /** Colaboradores enviados a la plataforma. */
  sent: number
  created: number
  updated: number
  /** Los que la plataforma descartó aun así. */
  rejected: number
  /** Los que no se enviaron: sin teléfono o con uno que no es válido. */
  withoutPhone: number
  invalidPhone: number
  /** Entraron a la lista negra: quedan inactivos, fuera de toda campaña. */
  deactivated: number
  /** Salieron de la lista negra: vuelven a recibir. */
  reactivated: number
  /** Cambiaron de hotel o de estado: se les cambiaron las etiquetas. */
  retagged: number
}

export type WorkersMessagingSyncStatus =
  | { configured: false }
  | {
      configured: true
      /** Colaboradores con teléfono válido (uno por teléfono). */
      workers: number
      /** De ellos, los que ya son contacto con la etiqueta Oranje. */
      synced: number
      /** Los que faltan: son los que bloquean crear campaña. */
      pending: number
      /** Los que no se pueden sincronizar, para que Reclutamiento los corrija. */
      excluded: ExcludedWorker[]
    }

/** Un colaborador que no llega a la plataforma, y por qué. */
export interface ExcludedWorker {
  id: string
  fullName: string
  /** Tal como está guardado; vacío si no tiene. */
  phone: string
  reason: 'NO_PHONE' | 'INVALID_PHONE'
}

/** Un colaborador listo para la plataforma: su teléfono ya en E.164. */
export interface Reachable {
  worker: WorkerRow
  /** Con `+`, como lo escribe la importación. */
  e164: string
}

/**
 * «Sincronizar colaboradores» de Mensajería (idea del equipo, Hugo,
 * 2026-10-23): registra a los colaboradores del Pool como contactos de la
 * plataforma de mensajería, con etiquetas de su hotel y su estado para poder
 * elegirlos al crear una campaña.
 *
 * Van TODOS, también los de la lista negra (pueden salir de ella): a esos la
 * plataforma los tiene inactivos, y la plataforma nunca le escribe a un
 * inactivo. Inactivo y no baja: la baja es de compliance y no se deshace.
 * Oranje solo reactiva a los que él mismo desactivó (etiqueta BLACKLIST_TAG).
 *
 * Vive en Personal porque lee sus tablas; Mensajería (notifications) no puede
 * depender de Personal, que ya depende de ella.
 */
@Injectable()
export class WorkersMessagingSyncService {
  constructor(
    private readonly repo: WorkersRepository,
    private readonly platform: MessagingPlatformService,
  ) {}

  /**
   * Cuántos colaboradores faltan en la plataforma, comparando teléfonos: así
   * no lo engaña un contacto viejo de alguien que ya no está en Oranje.
   */
  async status(): Promise<WorkersMessagingSyncStatus> {
    if (!this.platform.enabled) return { configured: false }

    const { reachable, excluded } = classify(await this.allWorkers())
    try {
      const tagId = await this.platform.findTagId(ORANJE_TAG)
      const contacts = tagId === null ? [] : await this.platform.listTaggedContacts(tagId)
      const known = new Set(contacts.map((contact) => contact.phoneE164))
      const synced = reachable.filter(({ e164 }) => known.has(e164.slice(1))).length
      return {
        configured: true,
        workers: reachable.length,
        synced,
        pending: reachable.length - synced,
        excluded,
      }
    } catch (error) {
      throw toHttpError(error)
    }
  }

  async sync(): Promise<WorkersMessagingSyncResult> {
    if (!this.platform.enabled) {
      throw new ServiceUnavailableException({
        code: 'MESSAGING_NOT_CONFIGURED',
        message: 'Este ambiente no está conectado a la plataforma de mensajería.',
      })
    }

    const { reachable, excluded } = classify(await this.allWorkers())
    const withoutPhone = excluded.filter(({ reason }) => reason === 'NO_PHONE').length
    const invalidPhone = excluded.length - withoutPhone
    if (reachable.length === 0) {
      return {
        sent: 0,
        created: 0,
        updated: 0,
        rejected: 0,
        withoutPhone,
        invalidPhone,
        deactivated: 0,
        reactivated: 0,
        retagged: 0,
      }
    }

    try {
      const imported = await this.platform.importContacts(toCsv(reachable), ORANJE_TAG)
      const { deactivated, reactivated, retagged } = await this.reconcile(reachable)
      return {
        sent: reachable.length,
        created: imported.created,
        updated: imported.updated,
        rejected: imported.skipped,
        withoutPhone,
        invalidPhone,
        deactivated,
        reactivated,
        retagged,
      }
    } catch (error) {
      throw toHttpError(error)
    }
  }

  /**
   * Lo que la importación no hace, contacto por contacto y solo donde no
   * coincide con Oranje (normalmente pocos):
   *
   *  - Activo o no, según la lista negra. Solo se reactiva a quien desactivó
   *    Oranje (lleva BLACKLIST_TAG): a uno desactivado a mano no se le toca.
   *  - Las etiquetas «Hotel: …» y «Estado: …»: la importación las SUMA, y quien
   *    cambió de estado quedaba con el viejo y el nuevo, y una campaña por
   *    estado le llegaba igual (visto en la prueba local, 2026-10-23). Aquí se
   *    dejan solo las de hoy; las demás etiquetas del contacto no se tocan.
   */
  private async reconcile(
    reachable: Reachable[],
  ): Promise<{ deactivated: number; reactivated: number; retagged: number }> {
    const none = { deactivated: 0, reactivated: 0, retagged: 0 }
    const tags = await this.platform.listTags()
    const tagIdByName = new Map(tags.map((tag) => [tag.name, tag.id]))
    const oranjeTagId = tagIdByName.get(ORANJE_TAG)
    if (oranjeTagId === undefined) return none

    const byPhone = new Map(reachable.map(({ worker, e164 }) => [e164.slice(1), worker]))
    const contacts = await this.platform.listTaggedContacts(oranjeTagId)
    const mustDeactivate = contacts.some(
      (contact) => contact.isActive && byPhone.get(contact.phoneE164)?.isBlacklisted === true,
    )
    // La marca se crea solo si hace falta poner una; si no existe, nadie la lleva.
    const markId = mustDeactivate
      ? await this.platform.ensureTagId(BLACKLIST_TAG)
      : (tagIdByName.get(BLACKLIST_TAG) ?? null)
    const managed = new Set(tags.filter((tag) => isManagedTag(tag.name)).map((tag) => tag.id))

    let deactivated = 0
    let reactivated = 0
    let retagged = 0
    for (const contact of contacts) {
      const worker = byPhone.get(contact.phoneE164)
      if (worker === undefined) continue

      const current = contact.tags.map(({ tag }) => tag.id)
      // Las de hoy: la importación ya las creó, así que todas tienen id.
      const expected = workerTags(worker).flatMap((name) => tagIdByName.get(name) ?? [])
      let next = [...current.filter((id) => !managed.has(id)), ...expected]
      let isActive = contact.isActive

      if (worker.isBlacklisted && contact.isActive && markId !== null) {
        isActive = false
        next = [...next, markId]
        deactivated += 1
      } else if (
        !worker.isBlacklisted &&
        !contact.isActive &&
        markId !== null &&
        current.includes(markId)
      ) {
        isActive = true
        next = next.filter((id) => id !== markId)
        reactivated += 1
      }

      const tagsChanged = !sameIds(current, next)
      if (tagsChanged && isActive === contact.isActive) retagged += 1
      if (tagsChanged || isActive !== contact.isActive) {
        await this.platform.setContactActive(contact.id, isActive, next)
      }
    }
    return { deactivated, reactivated, retagged }
  }

  private async allWorkers(): Promise<WorkerRow[]> {
    const filter = {
      page: 1,
      limit: PAGE_SIZE,
      onlyAvailable: false,
      hasPendingDocument: false,
      withoutActiveAssignment: false,
    }
    const rows: WorkerRow[] = []
    for (;;) {
      const { rows: page, total } = await this.repo.findMany(filter)
      rows.push(...page)
      if (page.length === 0 || rows.length >= total) return rows
      filter.page += 1
    }
  }
}

/**
 * Con la misma regla que la plataforma (libphonenumber, EE. UU. si no trae
 * `+`): un teléfono que ella rechazaría no se cuenta, o el aviso de «faltan
 * por sincronizar» no se apagaría nunca. Uno por teléfono, como ella.
 */
function classify(workers: WorkerRow[]): { reachable: Reachable[]; excluded: ExcludedWorker[] } {
  const byPhone = new Map<string, Reachable>()
  const excluded: ExcludedWorker[] = []
  for (const worker of workers) {
    const raw = worker.phone.trim()
    const parsed = raw === '' ? undefined : parsePhoneNumberFromString(raw, 'US')
    if (!parsed?.isValid()) {
      excluded.push({
        id: worker.id,
        fullName: worker.fullName,
        phone: raw,
        reason: raw === '' ? 'NO_PHONE' : 'INVALID_PHONE',
      })
      continue
    }
    byPhone.set(parsed.number, { worker, e164: parsed.number })
  }
  return { reachable: [...byPhone.values()], excluded }
}

/**
 * El CSV que entiende la importación: Nombre, Apellido, Teléfono y Etiquetas
 * (varias separadas por `;`). La columna extra `oranjeId` la guarda la
 * plataforma como campo propio del contacto, para saber de quién es.
 */
export function toCsv(reachable: Reachable[]): string {
  const lines = [['Nombre', 'Apellido', 'Telefono', 'Etiquetas', 'oranjeId']]
  for (const { worker, e164 } of reachable) {
    const [firstName = worker.fullName, ...rest] = worker.fullName.trim().split(/\s+/)
    lines.push([firstName, rest.join(' '), e164, workerTags(worker).join(';'), worker.id])
  }
  // El BOM le dice a la importación (SheetJS) que es UTF-8; sin él lee Latin-1
  // y «Gómez» llega como «GÃ³mez» (visto en la prueba local, 2026-10-23).
  return '\uFEFF' + lines.map((line) => line.map(csvCell).join(',')).join('\n')
}

/** Las etiquetas de hoy de un colaborador: su estado y, si trabaja, su hotel. */
function workerTags(worker: WorkerRow): string[] {
  const tags = [`${STATE_PREFIX}${worker.state.name}`]
  if (worker.assignment !== null) tags.push(`${HOTEL_PREFIX}${worker.assignment.hotelName}`)
  return tags.map(tagName)
}

/** Las que Oranje pone y quita en cada sincronización. */
function isManagedTag(name: string): boolean {
  return name.startsWith(STATE_PREFIX) || name.startsWith(HOTEL_PREFIX)
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id))
}

/** La plataforma parte las etiquetas en `,` `;` y `|`: no pueden ir en el nombre. */
function tagName(raw: string): string {
  return raw.replace(/[,;|]/g, ' ').replace(/\s+/g, ' ').trim()
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Igual que Mensajería: un 4xx es para la persona; lo demás, falla (502). */
function toHttpError(error: unknown): unknown {
  if (error instanceof MessagingPlatformRejection && error.status !== 401 && error.status !== 403) {
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
