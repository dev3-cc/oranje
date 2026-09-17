import { Injectable } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

export const WORKER_LIGHT = 'WORKER'

export interface WorkerRow {
  id: string
  fullName: string
  birthDate: Date
  age: number
  gender: string
  phone: string
  address: string
  photoPath: string | null
  experienceLevel: string | null
  transportType: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelationship: string | null
  bloodType: string | null
  isProfileComplete: boolean
  hasTaxId: boolean
  hasAccount: boolean
  /// Hasta cuándo puede completar el expediente si se le validó a medias.
  profileDueAt: Date | null
  /// El correo de la cuenta corporativa (worker.user_id); null sin cuenta.
  email: string | null
  isBlacklisted: boolean
  createdAt: Date
  zone: { id: string; code: string; name: string }
  position: { id: string; code: string; name: string } | null
  englishLevel: { id: string; code: string; name: string } | null
  hiringModality: { id: string; code: string; name: string } | null
  state: { code: string; color: string; name: string }
}

export interface WorkerFilter {
  page: number
  limit: number
  state?: string | undefined
  zoneId?: string | undefined
  catalogPositionId?: string | undefined
  englishLevelId?: string | undefined
  search?: string | undefined
  onlyAvailable: boolean
}

const BASE = `
  SELECT w.id,
         w.full_name  AS "fullName",
         w.birth_date AS "birthDate",
         w.age,
         w.gender,
         w.phone,
         w.address,
         w.photo_path AS "photoPath",
         w.experience_level AS "experienceLevel",
         w.transport_type   AS "transportType",
         w.emergency_contact_name         AS "emergencyContactName",
         w.emergency_contact_phone        AS "emergencyContactPhone",
         w.emergency_contact_relationship AS "emergencyContactRelationship",
         w.blood_type          AS "bloodType",
         w.is_profile_complete AS "isProfileComplete",
         w.profile_due_at      AS "profileDueAt",
         w.has_tax_id          AS "hasTaxId",
         (w.user_id IS NOT NULL) AS "hasAccount",
         u.email AS "email",
         EXISTS (SELECT 1 FROM coverage.blacklist_entry b
                  WHERE b.worker_id = w.id AND b.lifted_at IS NULL) AS "isBlacklisted",
         w.created_at AS "createdAt",
         jsonb_build_object('id', z.id, 'code', z.code, 'name', z.name) AS zone,
         CASE WHEN p.id IS NULL THEN NULL ELSE
           jsonb_build_object('id', p.id, 'code', p.code, 'name', p.name) END AS position,
         CASE WHEN e.id IS NULL THEN NULL ELSE
           jsonb_build_object('id', e.id, 'code', e.code, 'name', e.name) END AS "englishLevel",
         CASE WHEN m.id IS NULL THEN NULL ELSE
           jsonb_build_object('id', m.id, 'code', m.code, 'name', m.name) END AS "hiringModality",
         jsonb_build_object('code', s.code, 'color', s.color, 'name', s.name) AS state
    FROM personal.vw_worker w
    JOIN catalogs.zone z ON z.id = w.zone_id
    JOIN catalogs.status_light_state s
      ON s.id = w.status_light_state_id AND s.status_light_code = 'WORKER'
    LEFT JOIN catalogs."position" p ON p.id = w.catalog_position_id
    LEFT JOIN catalogs.english_level e ON e.id = w.english_level_id
    LEFT JOIN catalogs.hiring_modality m ON m.id = w.hiring_modality_id
    LEFT JOIN identity."user" u ON u.id = w.user_id
   WHERE w.deleted_at IS NULL`

@Injectable()
export class WorkersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async stateByCode(code: string): Promise<{ id: string } | null> {
    return this.prisma.statusLightState.findFirst({
      where: { code, statusLightCode: WORKER_LIGHT },
      select: { id: true },
    })
  }

  async reasonByCode(code: string): Promise<{ id: string } | null> {
    return this.prisma.statusChangeReason.findFirst({
      where: { code, statusLight: { code: WORKER_LIGHT } },
      select: { id: true },
    })
  }

  async allowedFrom(stateId: string): Promise<
    Array<{
      toStateId: string | null
      code: string | null
      roleCode: string | null
      requiresReason: boolean
    }>
  > {
    const rows = await this.prisma.statusLightTransition.findMany({
      where: { fromStateId: stateId, statusLight: { code: WORKER_LIGHT } },
      select: {
        toStateId: true,
        requiresReason: true,
        toState: { select: { code: true } },
        authorizedRole: { select: { code: true } },
      },
    })

    return rows.map((r) => ({
      toStateId: r.toStateId,
      code: r.toState?.code ?? null,
      roleCode: r.authorizedRole?.code ?? null,
      requiresReason: r.requiresReason,
    }))
  }

  async findById(id: string): Promise<WorkerRow | null> {
    const rows = await this.prisma.$queryRawUnsafe<WorkerRow[]>(`${BASE} AND w.id = $1::uuid`, id)

    return rows[0] ?? null
  }

  // ¿Este colaborador tiene asignacion ACTIVA en este hotel? Es el alcance de
  // los roles de Hotel sobre Mi Personal: ven a quien esta trabajando con
  // ellos, no al Pool entero.
  async isAssignedToHotel(workerId: string, hotelId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ existe: boolean }>>`
      SELECT EXISTS (
        SELECT 1
          FROM coverage.assignment a
          JOIN demand.slot sl        ON sl.id = a.slot_id
          JOIN demand."position" p   ON p.id = sl.position_id
          JOIN demand.requisition r  ON r.id = p.requisition_id
         WHERE a.worker_id = ${workerId}::uuid
           AND a.status = 'ACTIVE'
           AND r.hotel_id = ${hotelId}::uuid) AS existe`

    return rows[0]?.existe ?? false
  }

  // ¿Tiene alguna asignación ACTIVA, en cualquier hotel? Eliminar a alguien
  // que ahora mismo está trabajando dejaría el turno sin nadie — se elimina
  // solo a quien no está colgado de ninguna.
  async hasActiveAssignment(workerId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ existe: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM coverage.assignment a
         WHERE a.worker_id = ${workerId}::uuid
           AND a.status = 'ACTIVE') AS existe`

    return rows[0]?.existe ?? false
  }

  // El hotel y departamento de la asignación ACTIVA del colaborador — para
  // resolver a quién avisar (el Manager de Área) cuando lo mandan a
  // descanso. RR-05 impide dos activas a la vez; si hubiera más de una por
  // algún hueco de datos, se toma la más reciente.
  async activeAssignmentScope(
    workerId: string,
  ): Promise<{ hotelId: string; departmentId: string } | null> {
    const rows = await this.prisma.$queryRaw<Array<{ hotelId: string; departmentId: string }>>`
      SELECT r.hotel_id AS "hotelId", p.hotel_department_id AS "departmentId"
        FROM coverage.assignment a
        JOIN demand.slot sl        ON sl.id = a.slot_id
        JOIN demand."position" p   ON p.id = sl.position_id
        JOIN demand.requisition r  ON r.id = p.requisition_id
       WHERE a.worker_id = ${workerId}::uuid
         AND a.status = 'ACTIVE'
       ORDER BY a.created_at DESC
       LIMIT 1`

    return rows[0] ?? null
  }

  // El Manager de Área responsable de ese departamento del hotel —o quien
  // cubre el hotel entero, si su cuenta no lleva departamento (jerarquía
  // simple, Reglas de Negocio · Cuentas del hotel). Se prefiere la cuenta con
  // el departamento exacto sobre la que cubre todo el hotel.
  async areaManagerOf(hotelId: string, departmentId: string): Promise<{ id: string } | null> {
    const scoped = await this.prisma.user.findFirst({
      where: { isActive: true, hotelId, departmentId, role: { code: 'ROL-H-02' } },
      select: { id: true },
    })

    if (scoped) {
      return scoped
    }

    return this.prisma.user.findFirst({
      where: { isActive: true, hotelId, departmentId: null, role: { code: 'ROL-H-02' } },
      select: { id: true },
    })
  }

  // El Inspector de la zona del colaborador (RR-13). Mismo patrón que
  // `AccidentsRepository.inspectorOfZone`, replicado aquí para no acoplar
  // `personal` a `supervision` por una sola consulta.
  async inspectorOfZone(zoneId: string): Promise<{ id: string } | null> {
    return this.prisma.user.findFirst({
      where: { isActive: true, role: { code: 'ROL-I-01' }, zones: { some: { zoneId } } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  // REASSIGN_REQUESTED: sin hotel ni zona que lo acote — Reclutamiento es un
  // solo equipo, no uno por hotel.
  async recruitmentManager(): Promise<{ id: string } | null> {
    return this.prisma.user.findFirst({
      where: { isActive: true, role: { code: 'ROL-R-03' } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  // REASSIGN_REQUESTED / UNASSIGN_REQUESTED: solo el registro, ninguna
  // transición — quien decide actúa por fuera con lo que ya existe hoy.
  async logRequest(params: {
    workerId: string
    eventType: string
    reason: string | null
    userId: string
    roleCode: string
  }): Promise<void> {
    await this.prisma.journalEntry.create({
      data: {
        id: uuidv7(),
        entityType: 'personal.worker',
        entityId: params.workerId,
        eventType: params.eventType,
        actorUserId: params.userId,
        actorRole: params.roleCode,
        payload: { reason: params.reason },
      },
    })
  }

  // Nunca se borra la fila (journal, historial del semáforo, auditorías...
  // todo cuelga de `worker_id`): `deleted_at` la saca del Pool y de toda
  // consulta que use BASE, sin romper esas referencias.
  async softDelete(params: { id: string; userId: string; roleCode: string }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.worker.update({
        where: { id: params.id },
        data: { deletedAt: new Date(), updatedAt: new Date() },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'personal.worker',
          entityId: params.id,
          eventType: 'WORKER_DELETED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: {},
        },
      })
    })
  }

  async findMany(
    filter: WorkerFilter,
    /** Mi Personal: solo colaboradores con asignación ACTIVA en este hotel. */
    assignedToHotelId: string | null = null,
  ): Promise<{ rows: WorkerRow[]; total: number }> {
    const where: string[] = []
    const args: unknown[] = []
    const add = (sql: string, value: unknown): void => {
      args.push(value)
      where.push(sql.replace('$n', `$${args.length}`))
    }

    if (assignedToHotelId) {
      add(
        `EXISTS (SELECT 1
                   FROM coverage.assignment a
                   JOIN demand.slot sl ON sl.id = a.slot_id
                   JOIN demand.position p ON p.id = sl.position_id
                   JOIN demand.requisition r ON r.id = p.requisition_id
                  WHERE a.worker_id = w.id
                    AND a.status = 'ACTIVE'
                    AND r.hotel_id = $n::uuid)`,
        assignedToHotelId,
      )
    }

    if (filter.state) add('s.code = $n', filter.state)
    if (filter.zoneId) add('w.zone_id = $n::uuid', filter.zoneId)
    if (filter.catalogPositionId) add('w.catalog_position_id = $n::uuid', filter.catalogPositionId)
    if (filter.englishLevelId) add('w.english_level_id = $n::uuid', filter.englishLevelId)
    /* Sin acentos ni mayúsculas en los dos lados: «jose» encuentra a «José».
       `ILIKE` solo ignora mayúsculas. `unaccent` no está en bootstrap.sql
       (sería migración + bootstrap); `translate` cubre el español hoy. */
    if (filter.search) {
      add(
        "translate(lower(w.full_name), 'áéíóúüñ', 'aeiouun') LIKE translate(lower($n), 'áéíóúüñ', 'aeiouun')",
        `%${filter.search}%`,
      )
    }

    if (filter.onlyAvailable) {
      where.push(`s.code IN ('STRONG_GREEN', 'YELLOW')`)
      where.push(`NOT EXISTS (SELECT 1 FROM coverage.blacklist_entry b
                               WHERE b.worker_id = w.id AND b.lifted_at IS NULL)`)
    }

    const filtro = where.length > 0 ? ` AND ${where.join(' AND ')}` : ''

    const rows = await this.prisma.$queryRawUnsafe<WorkerRow[]>(
      `${BASE}${filtro} ORDER BY w.full_name LIMIT $${args.length + 1} OFFSET $${args.length + 2}`,
      ...args,
      filter.limit,
      (filter.page - 1) * filter.limit,
    )

    const counted = await this.prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      `SELECT count(*) AS total
         FROM personal.vw_worker w
         JOIN catalogs.status_light_state s
           ON s.id = w.status_light_state_id AND s.status_light_code = 'WORKER'
        WHERE w.deleted_at IS NULL${filtro}`,
      ...args,
    )

    return { rows, total: Number(counted[0]?.total ?? 0) }
  }

  async create(params: {
    fullName: string
    birthDate: Date
    gender: string
    phone: string
    address: string
    photoPath: string | null
    zoneId: string
    catalogPositionId: string | null
    hiringModalityId: string | null
    englishLevelId: string | null
    experienceLevel: string | null
    transportType: string | null
    emergencyContactName: string | null
    emergencyContactPhone: string | null
    emergencyContactRelationship: string | null
    bloodType: string | null
    stateId: string
    userId: string
    roleCode: string
  }): Promise<string> {
    const id = uuidv7()

    await this.prisma.$transaction(async (tx) => {
      await tx.worker.create({
        data: {
          id,
          fullName: params.fullName,
          birthDate: params.birthDate,
          gender: params.gender,
          phone: params.phone,
          address: params.address,
          photoPath: params.photoPath,
          zoneId: params.zoneId,
          catalogPositionId: params.catalogPositionId,
          hiringModalityId: params.hiringModalityId,
          englishLevelId: params.englishLevelId,
          experienceLevel: params.experienceLevel,
          transportType: params.transportType,
          emergencyContactName: params.emergencyContactName,
          emergencyContactPhone: params.emergencyContactPhone,
          emergencyContactRelationship: params.emergencyContactRelationship,
          bloodType: params.bloodType,
          statusLightStateId: params.stateId,
          statusLightCode: WORKER_LIGHT,
          createdBy: params.userId,
        },
      })

      await tx.workerStateHistory.create({
        data: {
          id: uuidv7(),
          workerId: id,
          fromStateId: null,
          toStateId: params.stateId,
          statusLightCode: WORKER_LIGHT,
          userId: params.userId,
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'personal.worker',
          entityId: id,
          eventType: 'WORKER_CREATED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { fullName: params.fullName, zoneId: params.zoneId },
        },
      })
    })

    return id
  }

  async update(params: {
    id: string
    data: Record<string, unknown>
    userId: string
    roleCode: string
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.worker.update({
        where: { id: params.id },
        data: { ...params.data, updatedAt: new Date() },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'personal.worker',
          entityId: params.id,
          eventType: 'WORKER_UPDATED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { fields: Object.keys(params.data) },
        },
      })
    })
  }

  async changeState(params: {
    id: string
    fromStateId: string
    toStateId: string
    toStateCode: string
    reasonId: string | null
    note: string | null
    /** Validado a medias: hasta cuándo puede completar el expediente. */
    profileDueAt: Date | null
    userId: string
    roleCode: string
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.worker.update({
        where: { id: params.id },
        data: {
          statusLightStateId: params.toStateId,
          statusLightCode: WORKER_LIGHT,
          ...(params.profileDueAt ? { profileDueAt: params.profileDueAt } : {}),
          updatedAt: new Date(),
        },
      })

      await tx.workerStateHistory.create({
        data: {
          id: uuidv7(),
          workerId: params.id,
          fromStateId: params.fromStateId,
          toStateId: params.toStateId,
          statusLightCode: WORKER_LIGHT,
          reasonId: params.reasonId,
          userId: params.userId,
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'personal.worker',
          entityId: params.id,
          eventType: 'WORKER_STATE_CHANGED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: {
            toState: params.toStateCode,
            note: params.note,
            ...(params.profileDueAt ? { profileDueAt: params.profileDueAt.toISOString() } : {}),
          },
        },
      })
    })
  }

  async currentStateId(id: string): Promise<{ stateId: string; code: string } | null> {
    const row = await this.prisma.worker.findUnique({
      where: { id },
      select: { statusLightStateId: true, statusState: { select: { code: true } } },
    })

    return row ? { stateId: row.statusLightStateId, code: row.statusState.code } : null
  }

  async history(id: string): Promise<
    Array<{
      id: string
      fromState: string | null
      toState: string
      reason: string | null
      occurredAt: Date
      userName: string
    }>
  > {
    return this.prisma.$queryRaw`
      SELECT h.id,
             fs.code AS "fromState",
             ts.code AS "toState",
             r.name  AS reason,
             h.occurred_at AS "occurredAt",
             u.full_name AS "userName"
        FROM personal.worker_state_history h
        LEFT JOIN catalogs.status_light_state fs ON fs.id = h.from_state_id
        JOIN catalogs.status_light_state ts ON ts.id = h.to_state_id
        LEFT JOIN catalogs.status_change_reason r ON r.id = h.reason_id
        JOIN identity."user" u ON u.id = h.user_id
       WHERE h.worker_id = ${id}::uuid
       ORDER BY h.occurred_at DESC`
  }
}
