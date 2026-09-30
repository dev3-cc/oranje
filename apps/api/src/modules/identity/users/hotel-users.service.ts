import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { FirebaseAccountsError, FirebaseAccountsService } from '../../../infra/firebase/index.js'
import { MailerService } from '../../../infra/mailer/index.js'
import { NotificationPublisherService } from '../../notifications/index.js'
import { PermissionsService } from '../auth/permissions.service.js'

import type { CreateHotelUserDto } from './dto/create-hotel-user.dto.js'
import { GENERAL_MANAGER } from './dto/create-hotel-user.dto.js'
import type { QueryHotelUsersDto } from './dto/query-hotel-users.dto.js'
import type { UpdateHotelUserDto } from './dto/update-hotel-user.dto.js'
import type { HotelUserEntity, HotelUserWithInvitation } from './entities/hotel-user.entity.js'
import type { InvitationErrorCode } from './entities/staff-user.entity.js'
import { HotelUserRow, HotelUsersRepository } from './hotel-users.repository.js'
import type { Paginated } from './staff-users.service.js'

const SUPERVISOR = 'ROL-H-01'
const AREA_MANAGER = 'ROL-H-02'

/** Reglas de Negocio · Cuentas del hotel: a quién puede reportar cada rol. */
const ALLOWED_BOSSES: Record<string, readonly string[]> = {
  [SUPERVISOR]: [AREA_MANAGER, GENERAL_MANAGER],
  [AREA_MANAGER]: [GENERAL_MANAGER],
  [GENERAL_MANAGER]: [],
}

/** Nombres para los mensajes: ningún código llega a texto humano. */
/**
 * Si esta alta queda esperando el visto bueno del Administrador.
 *
 * Solo cuando se cumplen las dos cosas (Hugo, 2026-09-30):
 *
 * - la propone **el hotel**, no Oranje. Si invita el BD, el BDC o el propio
 *   Administrador, pedir que Oranje se apruebe a sí mismo sería ceremonia;
 * - y es un rol **gerencial**. Un supervisor invitado por su gerente entra
 *   directo, o volvemos a meter a Oranje en todo.
 */
function pendingApproval(
  roleCode: string,
  hotelId: string,
  actor: { hotelId: string | null },
): boolean {
  const desdeElHotel = actor.hotelId === hotelId

  return desdeElHotel && (roleCode === GENERAL_MANAGER_ROLE || roleCode === AREA_MANAGER_ROLE)
}

/** Los roles que invitan con límite; los demás caen en el guard general. */
const SALES_ROLE = 'ROL-V-01'
const AREA_MANAGER_ROLE = 'ROL-H-02'
const GENERAL_MANAGER_ROLE = 'ROL-H-03'

const ROLE_LABEL: Record<string, string> = {
  [SUPERVISOR]: 'Supervisor',
  [AREA_MANAGER]: 'Manager de Área',
  [GENERAL_MANAGER]: 'Manager General',
}

const EMAIL_CODES = new Set([
  'INVALID_EMAIL',
  'MISSING_EMAIL',
  'EMAIL_NOT_FOUND',
  'INVALID_RECIPIENT_EMAIL',
])

function invitationError(code: string): InvitationErrorCode {
  if (EMAIL_CODES.has(code)) {
    return 'EMAIL_REJECTED'
  }

  return code === 'UNKNOWN' ? 'UNKNOWN' : 'FIREBASE_UNAVAILABLE'
}

interface InvitationResult {
  sent: boolean
  error?: InvitationErrorCode
}

/**
 * Cuentas del hotel (Supervisor, Manager de Área, Manager General). El primer
 * Manager General lo crea el BDC en la Conversión; el resto, el Administrador
 * desde Usuarios — los dos caminos llegan aquí (Reglas de Negocio · Cuentas
 * del hotel).
 *
 * La credencial nace por invitación, igual que el personal: cuenta de Firebase
 * sin contraseña + correo de restablecimiento. Si el correo falla, el alta NO
 * se revierte: la fila queda, el journal registra y reenviar es aparte.
 */
@Injectable()
export class HotelUsersService {
  private readonly logger = new Logger(HotelUsersService.name)

  constructor(
    private readonly repo: HotelUsersRepository,
    private readonly accounts: FirebaseAccountsService,
    private readonly mailer: MailerService,
    private readonly permissions: PermissionsService,
    private readonly notifications: NotificationPublisherService,
  ) {}

  async list(hotelId: string, includeInactive: boolean): Promise<HotelUserEntity[]> {
    await this.assertHotel(hotelId)

    return (await this.repo.listAll(hotelId, includeInactive)).map(toEntity)
  }

  async directory(query: QueryHotelUsersDto): Promise<Paginated<HotelUserEntity>> {
    const { rows, total } = await this.repo.findMany(query)

    return {
      data: rows.map(toEntity),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    }
  }

  /**
   * Quién puede invitar a qué rol, y en qué hotel.
   *
   * Nace de un problema medido (Hugo, 2026-09-30): los gerentes de hotel
   * rotan, el nuevo no hereda el correo del anterior y cada cambio caía en
   * el Administrador. En producción **34 de 36 hoteles tienen un solo
   * gerente y nadie más**, así que «que invite quien ya está dentro» no
   * alcanza solo: por eso el BD también invita, en los hoteles de sus zonas.
   *
   * El reparto:
   *
   * - **Administrador y BDC**: como hasta ahora, sin límite de hotel.
   * - **BD**: cualquier cuenta, pero solo en los hoteles de sus zonas.
   * - **Manager General**: cualquier cuenta de SU hotel.
   * - **Manager de Área**: supervisores y managers de área de su hotel, y un
   *   Manager General **solo si el hotel se quedó sin ninguno activo**. Esa
   *   excepción es la que cubre la rotación; sin ella, el segundo de a bordo
   *   podría nombrarse jefe cuando quisiera.
   * - **Supervisor**: no invita. Crear un gerente desde el escalón más bajo
   *   es regalar el hotel entero.
   */
  private async assertCanInvite(
    hotelId: string,
    roleCode: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const [admin, conversion] = await Promise.all([
      this.permissions.can(actor.roleCode, 'users', 'manage_hotel'),
      this.permissions.can(actor.roleCode, 'conversion', 'create_hotel_user'),
    ])

    if (admin || conversion) return

    /* El BD: su alcance son las zonas, no un hotel (D-09). */
    if (actor.roleCode === SALES_ROLE) {
      if (!(await this.repo.hotelInUserZones(hotelId, actor.id))) {
        throw new ForbiddenException({
          code: 'HOTEL_OUT_OF_ZONE',
          message: 'Solo puedes invitar cuentas en los hoteles de tus zonas',
        })
      }

      return
    }

    /* Los roles del hotel: el suyo y nada más. */
    if (actor.hotelId !== hotelId) {
      throw new ForbiddenException({
        code: 'HOTEL_OUT_OF_SCOPE',
        message: 'Solo puedes invitar cuentas de tu propio hotel',
      })
    }

    if (actor.roleCode === GENERAL_MANAGER_ROLE) return

    if (actor.roleCode === AREA_MANAGER_ROLE) {
      if (roleCode !== GENERAL_MANAGER_ROLE) return

      /* La excepción de la rotación: se puede nombrar gerente solo cuando el
         hotel no tiene ninguno. Con uno activo, esto es el Administrador o
         el BD quien lo hace — o el propio gerente saliente. */
      if (await this.repo.hasActiveGeneralManager(hotelId)) {
        throw new ForbiddenException({
          code: 'HOTEL_HAS_GENERAL_MANAGER',
          message:
            'Este hotel ya tiene Manager General activo: el cambio lo hace él, tu Business Developer o el Administrador',
        })
      }

      return
    }

    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Tu rol no invita cuentas del hotel',
    })
  }

  async create(
    hotelId: string,
    dto: CreateHotelUserDto,
    actor: AuthenticatedUser,
  ): Promise<HotelUserWithInvitation> {
    await this.assertHotel(hotelId)
    await this.assertCanInvite(hotelId, dto.roleCode, actor)

    const role = await this.repo.roleByCode(dto.roleCode)

    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: `El rol ${ROLE_LABEL[dto.roleCode] ?? dto.roleCode} no existe`,
      })
    }

    if (await this.repo.emailTaken(dto.email)) {
      throw new ConflictException({
        code: 'EMAIL_TAKEN',
        message: `Ya existe un usuario con el correo ${dto.email}`,
      })
    }

    const departmentId = await this.resolveDepartment(dto.roleCode, dto.departmentId)

    if (dto.reportsToUserId) {
      await this.assertReportsTo(dto.roleCode, departmentId, dto.reportsToUserId, hotelId)
    }

    const row = await this.repo.create({
      hotelId,
      email: dto.email,
      fullName: dto.fullName,
      roleId: role.id,
      roleCode: dto.roleCode,
      departmentId,
      reportsToUserId: dto.reportsToUserId ?? null,
      locale: dto.locale,
      actorUserId: actor.id,
      actorRole: actor.roleCode,
    })

    await this.notifyAccountOwner(hotelId, row.id, dto.roleCode, actor)

    /*
     * Una cuenta GERENCIAL propuesta POR EL HOTEL espera el visto bueno del
     * Administrador (Hugo, 2026-09-30): el hotel propone y Oranje confirma.
     *
     * Mientras espera no se manda la invitación. Mandarla antes sería darle
     * a la persona un enlace que la deja fuera: la cuenta está inactiva y el
     * login la rechaza, así que pensaría que el sistema no sirve.
     */
    if (pendingApproval(dto.roleCode, hotelId, actor)) {
      await this.repo.deactivate(row.id)
      await this.notifyAdmins(row.id, dto.roleCode, row.fullName, actor)

      return withInvitation({ ...toEntity(row), isActive: false }, { sent: false })
    }

    const invitation = await this.sendInvitation(
      row.id,
      row.email,
      row.fullName,
      row.locale,
      row.role,
      { userId: actor.id, role: actor.roleCode },
      'invitation',
    )

    return withInvitation(toEntity(row), invitation)
  }

  /**
   * Avisa a los Administradores de que hay una cuenta gerencial esperando.
   *
   * El aviso va por rol y no a una persona: cualquiera de ellos puede
   * resolverlo, y atarlo a uno solo lo dejaría colgado cuando ese esté de
   * vacaciones.
   */
  private async notifyAdmins(
    userId: string,
    roleCode: string,
    fullName: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    try {
      await this.notifications.publish({
        type: 'HOTEL_ACCOUNT_PENDING',
        title: 'Cuenta de hotel por aprobar',
        body: `${fullName} fue propuesto como ${ROLE_LABEL[roleCode] ?? roleCode} por su hotel.`,
        entity: { type: 'identity.user', id: userId },
        actorUserId: actor.id,
        audience: [{ kind: 'ROLE', roleCode: 'ROL-ADM-01' }],
      })
    } catch {
      /* Mejor esfuerzo: la cuenta ya quedó pendiente y se ve en la lista. */
    }
  }

  /**
   * El visto bueno: activa la cuenta y **entonces** manda la invitación.
   *
   * El orden importa. Mandarla al proponer le daría a la persona un enlace
   * que la deja fuera, porque su cuenta todavía no entra.
   */
  async approve(id: string, actor: AuthenticatedUser): Promise<HotelUserWithInvitation> {
    const row = await this.repo.findById(id)

    if (!row) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Esa cuenta de hotel no existe',
      })
    }

    if (row.isActive) {
      throw new ConflictException({
        code: 'ALREADY_APPROVED',
        message: 'Esta cuenta ya está aprobada',
      })
    }

    await this.repo.approve(id, { userId: actor.id, role: actor.roleCode })

    const invitation = await this.sendInvitation(
      row.id,
      row.email,
      row.fullName,
      row.locale,
      row.role,
      { userId: actor.id, role: actor.roleCode },
      'invitation',
    )

    const fresh = await this.repo.findById(id)

    return withInvitation(toEntity(fresh ?? row), invitation)
  }

  /** Lo que el Administrador tiene por resolver. */
  async pendingApprovals(): Promise<HotelUserEntity[]> {
    return (await this.repo.pendingApprovals()).map(toEntity)
  }

  /**
   * Avisa al BD que lleva el hotel cuando la invitación vino DEL PROPIO
   * HOTEL.
   *
   * Solo en ese caso: si la mandó el BD, el Administrador o el BDC, avisarle
   * a quien acaba de hacerlo sería ruido. Y es mejor esfuerzo — que Pub/Sub
   * no responda no puede deshacer un alta que ya ocurrió.
   */
  private async notifyAccountOwner(
    hotelId: string,
    userId: string,
    roleCode: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (actor.hotelId !== hotelId) return

    try {
      const ownerUserId = await this.repo.accountOwner(hotelId)

      if (!ownerUserId) return

      await this.notifications.publish({
        type: 'HOTEL_ACCOUNT_INVITED',
        title: 'Cuenta nueva en tu hotel',
        body: `El hotel invitó a un ${ROLE_LABEL[roleCode] ?? roleCode}.`,
        entity: { type: 'identity.user', id: userId },
        actorUserId: actor.id,
        audience: [{ kind: 'USER', userId: ownerUserId }],
      })
    } catch {
      /* Mejor esfuerzo: el alta ya ocurrió y avisar es secundario. */
    }
  }

  async update(
    hotelId: string,
    id: string,
    dto: UpdateHotelUserDto,
    actor: AuthenticatedUser,
  ): Promise<HotelUserEntity> {
    const current = await this.findInHotel(hotelId, id)
    const roleCode = current.role.code

    const departmentId =
      dto.departmentId !== undefined
        ? await this.resolveDepartment(roleCode, dto.departmentId)
        : undefined

    if (dto.reportsToUserId) {
      if (dto.reportsToUserId === id) {
        throw new UnprocessableEntityException({
          code: 'REPORTS_TO_SELF',
          message: 'Nadie se reporta a sí mismo',
        })
      }

      await this.assertReportsTo(
        roleCode,
        departmentId === undefined ? (current.department?.id ?? null) : departmentId,
        dto.reportsToUserId,
        hotelId,
      )
    }

    const row = await this.repo.update(
      id,
      {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(departmentId !== undefined ? { departmentId } : {}),
        ...(dto.reportsToUserId !== undefined ? { reportsToUserId: dto.reportsToUserId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      { userId: actor.id, role: actor.roleCode },
      { ...dto },
    )

    return toEntity(row)
  }

  /** Reenvía la invitación mientras `firebase_uid` siga nulo. Aquí un fallo SÍ es error: reenviar ES el reintento. */
  async resendInvitation(
    hotelId: string,
    id: string,
    actor: AuthenticatedUser,
  ): Promise<HotelUserWithInvitation> {
    const row = await this.findInHotel(hotelId, id)

    if (row.firebaseUid !== null) {
      throw new ConflictException({
        code: 'ALREADY_ACTIVATED',
        message: 'Esta persona ya entró con su cuenta: no hay invitación que reenviar',
      })
    }

    const invitation = await this.sendInvitation(
      row.id,
      row.email,
      row.fullName,
      row.locale,
      row.role,
      { userId: actor.id, role: actor.roleCode },
      'resend',
    )

    if (!invitation.sent) {
      throw new UnprocessableEntityException({
        code: 'INVITATION_FAILED',
        message: 'No se pudo enviar la invitación. Inténtalo de nuevo en unos minutos',
      })
    }

    return withInvitation(toEntity(row), invitation)
  }

  private async findInHotel(hotelId: string, id: string): Promise<HotelUserRow> {
    await this.assertHotel(hotelId)

    const row = await this.repo.findById(id)

    if (!row || row.hotel.id !== hotelId) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Esa cuenta no existe en este hotel',
      })
    }

    return row
  }

  /**
   * Reglas de Negocio · Cuentas del hotel: el departamento es OPCIONAL para
   * Supervisor y Manager de Área — `null` significa que la cuenta cubre todo
   * el hotel (jerarquía simple, Hotel.md: "Manager General → SUP →
   * Colaboradores", sin split por departamento). Con departamento, queda
   * acotada a ese departamento (jerarquía extendida) — lo aplica
   * `assertDepartmentScope` en `RequisitionsService.create()`. El Manager
   * General nunca lleva departamento, en ninguna jerarquía.
   */
  private async resolveDepartment(
    roleCode: string,
    departmentId: string | null | undefined,
  ): Promise<string | null> {
    if (roleCode === GENERAL_MANAGER) {
      if (departmentId) {
        throw new UnprocessableEntityException({
          code: 'DEPARTMENT_NOT_ALLOWED',
          message: 'El Manager General cubre todos los departamentos de su hotel',
        })
      }

      return null
    }

    if (!departmentId) {
      return null
    }

    if (!(await this.repo.departmentExists(departmentId))) {
      throw new NotFoundException({
        code: 'DEPARTMENT_NOT_FOUND',
        message: 'El departamento no existe',
      })
    }

    return departmentId
  }

  /**
   * «Reporta a» vive dentro del mismo hotel y sigue la jerarquía: el Supervisor
   * a un Manager de Área de su departamento o al Manager General; el Manager de
   * Área al Manager General; el Manager General a nadie.
   */
  private async assertReportsTo(
    roleCode: string,
    departmentId: string | null,
    bossId: string,
    hotelId: string,
  ): Promise<void> {
    const boss = await this.repo.bossOfHotel(bossId, hotelId)

    if (!boss) {
      throw new UnprocessableEntityException({
        code: 'SUPERVISOR_NOT_IN_HOTEL',
        message: 'A quien reporta debe ser un usuario activo del mismo hotel',
      })
    }

    const allowed = ALLOWED_BOSSES[roleCode] ?? []

    if (!allowed.includes(boss.roleCode)) {
      const who = ROLE_LABEL[roleCode] ?? 'Este rol'
      const options = allowed.map((code) => ROLE_LABEL[code] ?? code).join(' o ')

      throw new UnprocessableEntityException({
        code: 'REPORTS_TO_NOT_ALLOWED',
        message:
          allowed.length === 0
            ? `${who} es la punta de la jerarquía del hotel: no reporta a nadie`
            : `${who} reporta a un ${options}`,
      })
    }

    if (
      boss.roleCode === AREA_MANAGER &&
      boss.departmentId !== null &&
      departmentId !== null &&
      boss.departmentId !== departmentId
    ) {
      throw new UnprocessableEntityException({
        code: 'REPORTS_TO_OTHER_DEPARTMENT',
        message: 'El Manager de Área al que reporta debe ser de su mismo departamento',
      })
    }
  }

  private async sendInvitation(
    userId: string,
    email: string,
    fullName: string,
    locale: string | null,
    /** Con un rol de gerencia sale su propia plantilla, que nombra el puesto. */
    role: { code: string; name: string },
    actor: { userId: string; role: string },
    kind: 'invitation' | 'resend',
  ): Promise<InvitationResult> {
    try {
      // EMAIL_EXISTS aquí NO es error: la cuenta pudo crearse a mano y el
      // enlace ocurre en el primer login.
      await this.accounts.createAccount(email)
      const delivery = await this.mailer.sendAccountEmail({
        kind: 'invitation',
        to: email,
        name: fullName,
        roleCode: role.code,
        roleName: role.name,
        // D-36: le escribimos en SU idioma. Quien nunca ha entrado lo tiene
        // en español, que es el idioma con el que nace la columna.
        locale: locale === 'en' ? 'en' : 'es',
        userId,
      })

      if (delivery.status === 'FAILED') {
        // Ni el SMTP propio ni el respaldo de Firebase: cae al catch de abajo,
        // que es quien deja el rastro de la invitación fallida.
        throw new Error('El correo de invitación no salió por ningún camino')
      }

      // `transport` dice si salió por lo nuestro o por el respaldo: sin eso, un
      // correo con la plantilla vieja de Firebase parece un misterio.
      await this.repo.journal(userId, 'HOTEL_USER_INVITATION_SENT', actor, {
        email,
        kind,
        transport: delivery.transport,
      })

      return { sent: true }
    } catch (error) {
      const code = error instanceof FirebaseAccountsError ? error.code : 'UNKNOWN'
      const detail = error instanceof FirebaseAccountsError ? error.detail : String(error)

      this.logger.warn(`La invitación a ${email} no salió: ${detail}`)

      try {
        await this.repo.journal(userId, 'HOTEL_USER_INVITATION_FAILED', actor, {
          email,
          kind,
          error: code,
          detail,
        })
      } catch {
        // Si ni el journal se pudo, ya quedó en el log: el alta no se cae.
      }

      return { sent: false, error: invitationError(code) }
    }
  }

  private async assertHotel(hotelId: string): Promise<void> {
    if (!(await this.repo.hotelExists(hotelId))) {
      throw new NotFoundException({ code: 'HOTEL_NOT_FOUND', message: 'El hotel no existe' })
    }
  }
}

function withInvitation(
  entity: HotelUserEntity,
  invitation: InvitationResult,
): HotelUserWithInvitation {
  return {
    ...entity,
    invitationSent: invitation.sent,
    ...(invitation.error ? { invitationError: invitation.error } : {}),
  }
}

function toEntity(row: HotelUserRow): HotelUserEntity {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    hotel: row.hotel,
    department: row.department,
    reportsToUserId: row.reportsToUserId,
    hasAccount: row.firebaseUid !== null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  }
}
