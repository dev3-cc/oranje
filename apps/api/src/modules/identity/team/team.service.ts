import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { PrismaService } from '../../../infra/prisma/index.js'
import { StorageService } from '../../../infra/storage/index.js'
import { StaffUsersService } from '../users/staff-users.service.js'

const LIDER = 'ROL-R-02'
const MANAGER_DE_AREA = 'ROL-H-02'
const SUPERVISOR = 'ROL-H-01'
const RECLUTADORA = 'ROL-R-01'
const ROLES_DEL_EQUIPO = [LIDER, RECLUTADORA]
/** Requisiciones que todavía piden trabajo: autorizada, en proceso o cubierta a medias. */
const REQUISICION_ABIERTA = ['GREEN', 'YELLOW', 'RED']
const REQUISICION_CUBIERTA = 'LIGHT_BLUE'
const VENTANA_DIAS = 30
/** Cuántas altas en Blanco se listan por persona; el total sigue en `pendingValidation`. */
const POR_VALIDAR_LISTADAS = 10
/** Cuántas altas del mes se listan por persona; el total sigue en `workersCreatedLast30Days`. */
const ALTAS_LISTADAS = 50

/**
 * Una persona del equipo de la Manager de Reclutamiento, con lo que hace falta
 * para ver su carga sin abrir otra pantalla. Todo se cuenta en el servidor; las
 * listas son para llegar a cada requisición y a cada alta, no para contar.
 */
export interface RecruitmentMemberEntity {
  id: string
  fullName: string
  email: string
  role: { code: string; name: string }
  photoUrl: string | null
  /** A quién reporta dentro del equipo: la propia Manager o una Líder. */
  reportsTo: { id: string; fullName: string } | null
  /** Requisiciones que tomó y siguen abiertas (Autorizada, En proceso o Cubierta parcialmente). */
  activeRequisitions: number
  /** Requisiciones que tomó y ya están cubiertas totalmente. */
  coveredRequisitions: number
  assignmentsLast30Days: number
  workersCreatedLast30Days: number
  /** Colaboradores que dio de alta y siguen en Blanco, sin validar. */
  pendingValidation: number
  /** Las requisiciones abiertas que tomó, para llegar a cada una desde Mi Equipo. */
  openRequisitions: Array<{ id: string; number: string; hotelName: string; statusCode: string }>
  /** Sus altas en Blanco, la más reciente primero; a lo más `POR_VALIDAR_LISTADAS`. */
  pendingWorkers: Array<{ id: string; fullName: string; createdAt: string }>
  /** Quiénes dio de alta en los últimos 30 días y en qué estado siguen; a lo más `ALTAS_LISTADAS`. */
  recentWorkers: Array<{ id: string; fullName: string; createdAt: string; statusCode: string }>
  /** Su último alta o su última asignación; `null` si todavía no hizo ninguna. */
  lastActivityAt: string | null
}

/** Una persona del equipo del Manager General: sus Managers de Área y sus Supervisores. */
export interface HotelTeamMemberEntity {
  id: string
  fullName: string
  email: string
  role: { code: string; name: string }
  photoUrl: string | null
  department: { id: string; name: string } | null
  reportsTo: { id: string; fullName: string } | null
  /** Manager de Área: Supervisores activos que le reportan. `null` en un Supervisor. */
  supervisorsInCharge: number | null
  /**
   * Manager de Área: colaboradores con una asignación activa en su departamento
   * de este hotel. `null` en un Supervisor o en un gerente sin departamento.
   */
  activeWorkers: number | null
  /** Supervisor: requisiciones que creó desde el día 1 del mes, en la zona del hotel. `null` en un gerente. */
  requisitionsThisMonth: number | null
}

export interface MemberEntity {
  id: string
  fullName: string
  email: string
  role: { code: string; name: string }
  /** URL firmada de la foto (D-30); `null` sin foto o si el firmado falla. */
  photoUrl: string | null
  zones: Array<{ id: string; code: string; name: string }>
  openProspects: number
}

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly staffUsers: StaffUsersService,
  ) {}

  async members(actor: AuthenticatedUser): Promise<MemberEntity[]> {
    const rows = await this.prisma.user.findMany({
      where: { reportsToUserId: actor.id, isActive: true },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        photoPath: true,
        role: { select: { code: true, name: true } },
        zones: { select: { zone: { select: { id: true, code: true, name: true } } } },
        _count: { select: { prospectsOwned: { where: { closedAt: null } } } },
      },
    })

    // Una firma por ruta distinta: la misma foto en dos filas se firma una vez.
    const paths = [...new Set(rows.flatMap((r) => (r.photoPath ? [r.photoPath] : [])))]
    const urls = await Promise.all(paths.map((path) => this.storage.signedUrl(path)))
    const photos = new Map(paths.map((path, index) => [path, urls[index] ?? null]))

    return rows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      email: r.email,
      role: r.role,
      photoUrl: r.photoPath ? (photos.get(r.photoPath) ?? null) : null,
      zones: r.zones.map((z) => z.zone),
      openProspects: r._count.prospectsOwned,
    }))
  }

  /**
   * El equipo de Reclutamiento de quien pregunta: quienes le reportan directo y
   * quienes reportan a esas personas (sus Líderes y las Reclutadoras de cada
   * Líder). Dos niveles bastan: es la jerarquía entera del departamento.
   */
  async recruitmentTeam(actor: AuthenticatedUser): Promise<RecruitmentMemberEntity[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { code: { in: ROLES_DEL_EQUIPO } },
        OR: [{ reportsToUserId: actor.id }, { reportsTo: { reportsToUserId: actor.id } }],
      },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        photoPath: true,
        role: { select: { code: true, name: true } },
        reportsTo: { select: { id: true, fullName: true } },
      },
    })
    if (rows.length === 0) return []

    const ids = rows.map((r) => r.id)
    const desde = new Date(Date.now() - VENTANA_DIAS * 86_400_000)

    const [participaciones, asignaciones, asignacionesRecientes, altas, altasRecientes, enBlanco] =
      await Promise.all([
        this.prisma.participation.findMany({
          where: { userId: { in: ids }, leftAt: null },
          select: {
            userId: true,
            requisition: {
              select: {
                id: true,
                number: true,
                hotel: { select: { name: true } },
                statusState: { select: { code: true } },
              },
            },
          },
        }),
        this.prisma.assignment.groupBy({
          by: ['assignedBy'],
          where: { assignedBy: { in: ids } },
          _max: { createdAt: true },
        }),
        this.prisma.assignment.groupBy({
          by: ['assignedBy'],
          where: { assignedBy: { in: ids }, createdAt: { gte: desde } },
          _count: { _all: true },
        }),
        this.prisma.worker.groupBy({
          by: ['createdBy'],
          where: { createdBy: { in: ids } },
          _max: { createdAt: true },
        }),
        this.prisma.worker.findMany({
          where: { createdBy: { in: ids }, createdAt: { gte: desde } },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            fullName: true,
            createdAt: true,
            createdBy: true,
            statusState: { select: { code: true } },
          },
        }),
        this.prisma.worker.findMany({
          where: { createdBy: { in: ids }, statusState: { code: 'WHITE' } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, fullName: true, createdAt: true, createdBy: true },
        }),
      ])

    const contar = (
      filas: Array<{ _count: { _all: number } } & Record<string, unknown>>,
      campo: string,
    ) => new Map(filas.map((f) => [f[campo] as string, f._count._all]))
    const ultima = (
      filas: Array<{ _max: { createdAt: Date | null } } & Record<string, unknown>>,
      campo: string,
    ) => new Map(filas.map((f) => [f[campo] as string, f._max.createdAt]))

    const asignadasRecientes = contar(asignacionesRecientes, 'assignedBy')
    const ultimaAsignacion = ultima(asignaciones, 'assignedBy')
    const ultimaAlta = ultima(altas, 'createdBy')

    const paths = [...new Set(rows.flatMap((r) => (r.photoPath ? [r.photoPath] : [])))]
    const urls = await Promise.all(paths.map((path) => this.storage.signedUrl(path)))
    const photos = new Map(paths.map((path, index) => [path, urls[index] ?? null]))

    return rows.map((r) => {
      const suyas = participaciones.filter((p) => p.userId === r.id)
      const abiertas = suyas
        .filter((p) => REQUISICION_ABIERTA.includes(p.requisition.statusState.code))
        .map((p) => p.requisition)
        .sort((a, b) => b.number.localeCompare(a.number))
      const sinValidar = enBlanco.filter((w) => w.createdBy === r.id)
      const delMes = altasRecientes.filter((w) => w.createdBy === r.id)
      const fechas = [ultimaAsignacion.get(r.id), ultimaAlta.get(r.id)].filter(
        (d): d is Date => d instanceof Date,
      )
      const ultimaActividad = fechas.length
        ? new Date(Math.max(...fechas.map((d) => d.getTime()))).toISOString()
        : null
      return {
        id: r.id,
        fullName: r.fullName,
        email: r.email,
        role: r.role,
        photoUrl: r.photoPath ? (photos.get(r.photoPath) ?? null) : null,
        reportsTo: r.reportsTo,
        activeRequisitions: abiertas.length,
        coveredRequisitions: suyas.filter(
          (p) => p.requisition.statusState.code === REQUISICION_CUBIERTA,
        ).length,
        assignmentsLast30Days: asignadasRecientes.get(r.id) ?? 0,
        workersCreatedLast30Days: delMes.length,
        pendingValidation: sinValidar.length,
        lastActivityAt: ultimaActividad,
        openRequisitions: abiertas.map((req) => ({
          id: req.id,
          number: req.number,
          hotelName: req.hotel.name,
          statusCode: req.statusState.code,
        })),
        pendingWorkers: sinValidar.slice(0, POR_VALIDAR_LISTADAS).map((w) => ({
          id: w.id,
          fullName: w.fullName,
          createdAt: w.createdAt.toISOString(),
        })),
        recentWorkers: delMes.slice(0, ALTAS_LISTADAS).map((w) => ({
          id: w.id,
          fullName: w.fullName,
          createdAt: w.createdAt.toISOString(),
          statusCode: w.statusState.code,
        })),
      }
    })
  }

  /**
   * El equipo del Manager General: los Managers de Área de su hotel y, si
   * puede verlos, sus Supervisores. Por ahora solo tres números (Hugo,
   * 2026-10-21): a cuántos supervisores y colaboradores tiene cada gerente, y
   * cuántas requisiciones creó cada supervisor en el mes. Altas y bajas siguen
   * siendo del Administrador.
   */
  async hotelTeam(
    actor: AuthenticatedUser,
    withSupervisors: boolean,
  ): Promise<HotelTeamMemberEntity[]> {
    if (!actor.hotelId) return []
    const roles = withSupervisors ? [MANAGER_DE_AREA, SUPERVISOR] : [MANAGER_DE_AREA]
    const rows = await this.prisma.user.findMany({
      where: {
        hotelId: actor.hotelId,
        isActive: true,
        id: { not: actor.id },
        role: { code: { in: roles } },
      },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        photoPath: true,
        role: { select: { code: true, name: true } },
        department: { select: { id: true, name: true } },
        reportsTo: { select: { id: true, fullName: true } },
      },
    })

    const hotelId = actor.hotelId
    const gerentes = rows.filter((r) => r.role.code === MANAGER_DE_AREA)
    const supervisores = rows.filter((r) => r.role.code === SUPERVISOR)
    const departamentos = [
      ...new Set(gerentes.flatMap((g) => (g.department ? [g.department.id] : []))),
    ]

    // El mes empieza el día 1 a medianoche donde está el hotel, no en UTC.
    const [inicioDeMes] = await this.prisma.$queryRaw<Array<{ desde: Date }>>`
      SELECT (date_trunc('month', now() AT TIME ZONE h.time_zone) AT TIME ZONE h.time_zone) AS desde
      FROM commercial.hotel h
      WHERE h.id = ${hotelId}::uuid`

    const [aCargo, asignaciones, creadas] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['reportsToUserId'],
        where: {
          hotelId,
          isActive: true,
          role: { code: SUPERVISOR },
          reportsToUserId: { in: gerentes.map((g) => g.id) },
        },
        _count: { _all: true },
      }),
      departamentos.length === 0
        ? Promise.resolve([])
        : this.prisma.assignment.findMany({
            where: {
              status: 'ACTIVE',
              slot: {
                position: { hotelDepartmentId: { in: departamentos }, requisition: { hotelId } },
              },
            },
            select: {
              workerId: true,
              slot: { select: { position: { select: { hotelDepartmentId: true } } } },
            },
          }),
      supervisores.length === 0 || !inicioDeMes
        ? Promise.resolve([])
        : this.prisma.requisition.groupBy({
            by: ['createdBy'],
            where: {
              hotelId,
              createdBy: { in: supervisores.map((s) => s.id) },
              createdAt: { gte: inicioDeMes.desde },
            },
            _count: { _all: true },
          }),
    ])

    const supervisoresDe = new Map(aCargo.map((f) => [f.reportsToUserId, f._count._all]))
    const colaboradoresPorDepto = new Map<string, Set<string>>()
    for (const a of asignaciones) {
      const depto = a.slot.position.hotelDepartmentId
      const set = colaboradoresPorDepto.get(depto) ?? new Set<string>()
      set.add(a.workerId)
      colaboradoresPorDepto.set(depto, set)
    }
    const creadasPor = new Map(creadas.map((f) => [f.createdBy, f._count._all]))

    const paths = [...new Set(rows.flatMap((r) => (r.photoPath ? [r.photoPath] : [])))]
    const urls = await Promise.all(paths.map((path) => this.storage.signedUrl(path)))
    const photos = new Map(paths.map((path, index) => [path, urls[index] ?? null]))

    return rows.map((r) => {
      const esGerente = r.role.code === MANAGER_DE_AREA
      return {
        id: r.id,
        fullName: r.fullName,
        email: r.email,
        role: r.role,
        photoUrl: r.photoPath ? (photos.get(r.photoPath) ?? null) : null,
        department: r.department,
        reportsTo: r.reportsTo,
        supervisorsInCharge: esGerente ? (supervisoresDe.get(r.id) ?? 0) : null,
        activeWorkers:
          esGerente && r.department
            ? (colaboradoresPorDepto.get(r.department.id)?.size ?? 0)
            : null,
        requisitionsThisMonth: esGerente ? null : (creadasPor.get(r.id) ?? 0),
      }
    })
  }

  /**
   * Mueve a una Reclutadora de su equipo con otra Líder, o directo a la propia
   * Manager. Solo dentro del equipo de quien lo pide: no se puede mandar a
   * nadie fuera ni traer a alguien de otra jerarquía. La bitácora y el aviso
   * `TEAM_CHANGED` los pone la actualización de personal de siempre.
   */
  async moveRecruiter(
    actor: AuthenticatedUser,
    memberId: string,
    reportsToUserId: string,
  ): Promise<{ id: string; reportsToUserId: string }> {
    const equipo = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { code: { in: ROLES_DEL_EQUIPO } },
        OR: [{ reportsToUserId: actor.id }, { reportsTo: { reportsToUserId: actor.id } }],
      },
      select: { id: true, role: { select: { code: true } } },
    })
    const miembro = equipo.find((u) => u.id === memberId)
    if (!miembro || miembro.role.code !== RECLUTADORA) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_IN_TEAM',
        message: 'Esa Reclutadora no está en tu equipo',
      })
    }
    const destinoValido =
      reportsToUserId === actor.id ||
      equipo.some((u) => u.id === reportsToUserId && u.role.code === LIDER)
    if (!destinoValido) {
      throw new UnprocessableEntityException({
        code: 'INVALID_TEAM_LEAD',
        message: 'Solo se mueve con una Líder de tu equipo o contigo',
      })
    }
    await this.staffUsers.update(memberId, { reportsToUserId }, actor)
    return { id: memberId, reportsToUserId }
  }
}
