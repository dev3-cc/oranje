import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import type { CreateHotelUserDto } from './dto/create-hotel-user.dto.js'
import { GENERAL_MANAGER } from './dto/create-hotel-user.dto.js'
import type { QueryHotelUsersDto } from './dto/query-hotel-users.dto.js'
import type { UpdateHotelUserDto } from './dto/update-hotel-user.dto.js'
import type { HotelUserEntity, HotelUserWithInvitation } from './entities/hotel-user.entity.js'
import type { InvitationErrorCode } from './entities/staff-user.entity.js'
import { FirebaseAccountsError, FirebaseAccountsService } from './firebase-accounts.service.js'
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

  async create(
    hotelId: string,
    dto: CreateHotelUserDto,
    actor: AuthenticatedUser,
  ): Promise<HotelUserWithInvitation> {
    await this.assertHotel(hotelId)

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
      actorUserId: actor.id,
      actorRole: actor.roleCode,
    })

    const invitation = await this.sendInvitation(
      row.id,
      row.email,
      { userId: actor.id, role: actor.roleCode },
      'invitation',
    )

    return withInvitation(toEntity(row), invitation)
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
    actor: { userId: string; role: string },
    kind: 'invitation' | 'resend',
  ): Promise<InvitationResult> {
    try {
      // EMAIL_EXISTS aquí NO es error: la cuenta pudo crearse a mano y el
      // enlace ocurre en el primer login.
      await this.accounts.createAccount(email)
      await this.accounts.sendPasswordReset(email)
      await this.repo.journal(userId, 'HOTEL_USER_INVITATION_SENT', actor, { email, kind })

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
