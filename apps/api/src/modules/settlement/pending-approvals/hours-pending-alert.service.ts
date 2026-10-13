import { Injectable } from '@nestjs/common'
import { v5 as uuidv5, v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'
import type { Audience } from '../../notifications/dto/event.dto.js'
import { NotificationPublisherService } from '../../notifications/index.js'

import { PendingApprovalsRepository, PendingTimesheetRow } from './pending-approvals.repository.js'
import { isoDay } from './pending-approvals.service.js'

/** Lo que se registra en el journal para no volver a avisar la misma semana. */
const ALERT_ENTITY_TYPE = 'settlement.pending_hours_alert'
const ALERT_EVENT = 'HOURS_PENDING_ALERTED'
const ALERT_NAMESPACE = 'oranje.hours-pending-alert'

/** Semanas cerradas hace menos de esto. Evita avisar de semanas viejas al primer arranque. */
const DEFAULT_LOOKBACK_DAYS = 14

export interface AlertRunResult {
  weeks: number
  sent: number
  skipped: number
}

/**
 * HOURS_PENDING (Catálogo de Notificaciones): cierre semanal con horas sin
 * aprobar, para el Manager de Área de cada departamento con pendientes.
 *
 * Es un servicio, no un cron: el disparador (un Cloud Scheduler que llame a
 * un endpoint, por ejemplo) todavía no existe. Cada corrida es idempotente:
 * un hotel y una semana se avisan una sola vez, porque el journal guarda el
 * aviso y se consulta antes de publicar. El índice único de `notification`
 * (usuario, tipo, entidad) es el respaldo si dos corridas se encimaran.
 *
 * Destinatarios: el ROL-H-02 (Manager de Área) de cada departamento con
 * pendientes, y el ROL-H-03 (Manager General) del hotel. Una persona no puede
 * tener dos roles (identity.user tiene un solo role_id), y el resolutor de
 * destinatarios ya deduplica por usuario.
 */
@Injectable()
export class HoursPendingAlertService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: PendingApprovalsRepository,
    private readonly publisher: NotificationPublisherService,
  ) {}

  async run(
    params: { hotelId?: string | undefined; lookbackDays?: number | undefined } = {},
  ): Promise<AlertRunResult> {
    const lookbackDays = params.lookbackDays ?? DEFAULT_LOOKBACK_DAYS
    const cutoffFrom = new Date(Date.now() - lookbackDays * 86_400_000)

    const rows = await this.repo.pending({ hotelId: params.hotelId, cutoffFrom })
    const groups = groupForAlert(rows)

    let sent = 0
    let skipped = 0

    for (const group of groups) {
      const entityId = alertEntityId(group.hotelId, group.weekStart)

      if (await this.alreadySent(entityId)) {
        skipped += 1
        continue
      }

      await this.publisher.publish({
        type: 'HOURS_PENDING',
        title: 'Horas sin aprobar',
        body: `La semana del ${group.weekStart} en ${group.hotelName} cerró con ${group.timesheets} ${group.timesheets === 1 ? 'hoja de horas' : 'hojas de horas'} sin aprobar. Lo que no se apruebe no entra al pago.`,
        entity: { type: 'operations.timesheet_week', id: entityId },
        audience: group.audience,
      })

      // Se registra DESPUÉS de publicar: si Pub/Sub falla, la siguiente
      // corrida lo intenta de nuevo en vez de darlo por enviado.
      await this.prisma.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: ALERT_ENTITY_TYPE,
          entityId: entityId,
          eventType: ALERT_EVENT,
          actorUserId: null,
          payload: {
            hotelId: group.hotelId,
            weekStart: group.weekStart,
            timesheets: group.timesheets,
            audience: group.audience.length,
          },
        },
      })

      sent += 1
    }

    return { weeks: groups.length, sent, skipped }
  }

  private async alreadySent(entityId: string): Promise<boolean> {
    const row = await this.prisma.journalEntry.findFirst({
      where: { entityType: ALERT_ENTITY_TYPE, entityId, eventType: ALERT_EVENT },
      select: { id: true },
    })

    return row !== null
  }
}

export interface AlertGroup {
  hotelId: string
  hotelName: string
  weekStart: string
  timesheets: number
  audience: Audience[]
}

/** Una entrada por hotel y semana, con la regla de audiencia de cada departamento pendiente. */
export function groupForAlert(rows: PendingTimesheetRow[]): AlertGroup[] {
  const groups = new Map<string, AlertGroup>()

  for (const row of rows) {
    const weekStart = isoDay(row.weekStart)
    const key = `${row.hotelId}|${weekStart}`
    const group = groups.get(key) ?? {
      hotelId: row.hotelId,
      hotelName: row.hotelName,
      weekStart,
      timesheets: 0,
      audience: [],
    }

    group.timesheets += 1

    const target: Audience =
      row.departmentId === null
        ? { kind: 'ROLE_IN_HOTEL', roleCode: 'ROL-H-02', hotelId: row.hotelId }
        : {
            kind: 'ROLE_IN_HOTEL_DEPARTMENT',
            roleCode: 'ROL-H-02',
            hotelId: row.hotelId,
            departmentId: row.departmentId,
          }

    const seen = group.audience.some((a) => JSON.stringify(a) === JSON.stringify(target))

    if (!seen) group.audience.push(target)

    const general: Audience = { kind: 'ROLE_IN_HOTEL', roleCode: 'ROL-H-03', hotelId: row.hotelId }
    if (!group.audience.some((a) => JSON.stringify(a) === JSON.stringify(general))) {
      group.audience.push(general)
    }

    groups.set(key, group)
  }

  return [...groups.values()]
}

/** Id estable por hotel y semana: es la entidad del aviso y la clave del journal. */
export function alertEntityId(hotelId: string, weekStart: string): string {
  return uuidv5(`${hotelId}|${weekStart}`, uuidv5(ALERT_NAMESPACE, uuidv5.URL))
}
