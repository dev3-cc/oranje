import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { StorageService } from '../../../infra/storage/index.js'

import { HOTEL_ROLES } from './dto/create-hotel-user.dto.js'
import type { CreateStaffUserDto } from './dto/create-staff-user.dto.js'
import type { QueryStaffUsersDto } from './dto/query-staff-users.dto.js'
import type { UpdateStaffUserDto } from './dto/update-staff-user.dto.js'
import type {
  InvitationErrorCode,
  StaffUserEntity,
  StaffUserWithInvitation,
} from './entities/staff-user.entity.js'
import { FirebaseAccountsError, FirebaseAccountsService } from './firebase-accounts.service.js'
import { StaffUserRow, StaffUsersRepository } from './staff-users.repository.js'

export interface Paginated<T> {
  data: T[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

type InvitationKind = 'invitation' | 'welcome' | 'resend'

interface InvitationResult {
  sent: boolean
  error?: InvitationErrorCode
}

// Identity Toolkit devuelve decenas de codigos; al front solo le sirven tres.
// Lo que el correo rechaza es cosa del dato —se corrige y se reintenta—; lo
// demas es que Firebase no respondio.
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

/**
 * Personal del SISTEMA: los roles de territorio y oficina. Los roles del hotel
 * entran por `POST /hotels/:hotelId/users`, que exige hotel y departamento —
 * aquí se rechazan para que no exista un camino que los cree sin alcance.
 *
 * La credencial nace de dos maneras (un solo punto de decisión, aquí):
 *  - invitación (default): cuenta de Firebase sin contraseña + correo de
 *    restablecimiento para que la persona ponga la suya. Si el correo falla,
 *    el alta NO se revierte: la fila queda, el journal registra y reenviar es
 *    aparte (`POST /users/:id/resend-invitation`).
 *  - contraseña puesta por el Administrador: la cuenta nace con ella y ES la
 *    de uso, sin cambio forzado. Jamás se persiste ni se registra: al journal
 *    va solo `credentialOrigin`, a los logs nada, la respuesta no la regresa.
 */
@Injectable()
export class StaffUsersService {
  private readonly logger = new Logger(StaffUsersService.name)

  constructor(
    private readonly repo: StaffUsersRepository,
    private readonly accounts: FirebaseAccountsService,
    private readonly storage: StorageService,
  ) {}

  async list(query: QueryStaffUsersDto): Promise<Paginated<StaffUserEntity>> {
    const { rows, total } = await this.repo.findMany(query)
    const photos = await this.signPhotos(rows)

    return {
      data: rows.map((row) => toEntity(row, photos)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    }
  }

  async get(id: string): Promise<StaffUserEntity> {
    const row = await this.repo.findById(id)

    if (!row) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'El usuario no existe' })
    }

    return toEntity(row, await this.signPhotos([row]))
  }

  // Se firman las rutas distintas, no una por fila: la misma foto en dos filas
  // se firma una vez. Si el firmado falla, la URL va null y el listado vive.
  private async signPhotos(rows: StaffUserRow[]): Promise<Map<string, string | null>> {
    const paths = [...new Set(rows.flatMap((row) => (row.photoPath ? [row.photoPath] : [])))]
    const urls = await Promise.all(paths.map((path) => this.storage.signedUrl(path)))

    return new Map(paths.map((path, index) => [path, urls[index] ?? null]))
  }

  async create(
    dto: CreateStaffUserDto,
    actor: AuthenticatedUser,
  ): Promise<StaffUserWithInvitation> {
    const roleId = await this.resolveRole(dto.roleCode)

    if (await this.repo.emailTaken(dto.email)) {
      throw new ConflictException({
        code: 'EMAIL_TAKEN',
        message: `Ya existe un usuario con el correo ${dto.email}`,
      })
    }

    if (dto.reportsToUserId) {
      await this.assertReportsTo(dto.reportsToUserId)
    }

    // Con contraseña, la cuenta va ANTES de la fila: si Firebase dice
    // EMAIL_EXISTS, sobreescribir esa contraseña sería peligroso — 409 y no
    // nace nada. (Sin contraseña el orden es el inverso y EMAIL_EXISTS se
    // tolera: cuentas de prueba creadas a mano se enlazan en el primer login.)
    if (dto.password !== undefined) {
      await this.createAccountWithPassword(dto.email, dto.password)
    }

    const row = await this.repo.create({
      email: dto.email,
      fullName: dto.fullName,
      roleId,
      roleCode: dto.roleCode,
      reportsToUserId: dto.reportsToUserId ?? null,
      photoPath: dto.photoPath ?? null,
      credentialOrigin: dto.password !== undefined ? 'password' : 'invitation',
      actorUserId: actor.id,
      actorRole: actor.roleCode,
    })

    const actorRef = { userId: actor.id, role: actor.roleCode }

    // Sin correo pedido no hay nada que reportar: `sent` en false y sin error.
    let invitation: InvitationResult = { sent: false }

    if (dto.password === undefined) {
      invitation = await this.sendInvitation(row.id, row.email, actorRef, 'invitation')
    } else if (dto.sendWelcomeEmail) {
      // El correo de bienvenida es el mismo sendOobCode («tienes cuenta con
      // este correo, establece la tuya aquí») y NUNCA lleva la contraseña; el
      // canal para decirla lo elige el Administrador.
      invitation = await this.sendInvitation(row.id, row.email, actorRef, 'welcome')
    }

    return withInvitation(toEntity(row, await this.signPhotos([row])), invitation)
  }

  async update(
    id: string,
    dto: UpdateStaffUserDto,
    actor: AuthenticatedUser,
  ): Promise<StaffUserEntity> {
    const current = await this.repo.findById(id)

    if (!current) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'El usuario no existe' })
    }

    const roleId = dto.roleCode !== undefined ? await this.resolveRole(dto.roleCode) : undefined

    if (dto.reportsToUserId) {
      if (dto.reportsToUserId === id) {
        throw new UnprocessableEntityException({
          code: 'REPORTS_TO_SELF',
          message: 'Nadie se reporta a sí mismo',
        })
      }
      await this.assertReportsTo(dto.reportsToUserId)
    }

    const row = await this.repo.update(
      id,
      {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(roleId !== undefined ? { roleId } : {}),
        ...(dto.reportsToUserId !== undefined ? { reportsToUserId: dto.reportsToUserId } : {}),
        ...(dto.photoPath !== undefined ? { photoPath: dto.photoPath } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      { userId: actor.id, role: actor.roleCode },
      { ...dto },
    )

    return toEntity(row, await this.signPhotos([row]))
  }

  /**
   * Reenvía la invitación mientras `firebase_uid` siga nulo (el chip
   * «Invitación enviada» de la maqueta sale de `hasAccount: false`). A
   * diferencia del alta, aquí un fallo SÍ es error: reenviar ES el reintento.
   */
  async resendInvitation(id: string, actor: AuthenticatedUser): Promise<StaffUserWithInvitation> {
    const row = await this.repo.findById(id)

    if (!row) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'El usuario no existe' })
    }

    if (row.firebaseUid !== null) {
      throw new ConflictException({
        code: 'ALREADY_LINKED',
        message: 'La cuenta ya está enlazada: la persona ya entró',
      })
    }

    const invitation = await this.sendInvitation(
      row.id,
      row.email,
      { userId: actor.id, role: actor.roleCode },
      'resend',
    )

    if (!invitation.sent) {
      throw new ServiceUnavailableException({
        code: 'INVITATION_FAILED',
        message: 'Firebase no pudo mandar el correo; intenta de nuevo',
        details: [{ field: 'invitationError', value: invitation.error ?? 'UNKNOWN' }],
      })
    }

    return withInvitation(toEntity(row, await this.signPhotos([row])), invitation)
  }

  private async createAccountWithPassword(email: string, password: string): Promise<void> {
    let outcome: 'created' | 'already_exists'

    try {
      outcome = await this.accounts.createAccount(email, password)
    } catch (error) {
      const code = error instanceof FirebaseAccountsError ? error.code : 'UNKNOWN'

      this.logger.error(`Firebase no pudo crear la cuenta: ${code}`)

      throw new ServiceUnavailableException({
        code: 'FIREBASE_UNAVAILABLE',
        message: 'Firebase no respondió; intenta de nuevo',
      })
    }

    if (outcome === 'already_exists') {
      throw new ConflictException({
        code: 'FIREBASE_EMAIL_EXISTS',
        message: 'Ese correo ya tiene cuenta en Firebase: usa invitación o el restablecimiento',
      })
    }
  }

  /**
   * Crea la cuenta (si hace falta) y dispara el correo. Nunca lanza: el
   * resultado —enviada o fallida— queda en el journal y regresa como booleano.
   */
  private async sendInvitation(
    userId: string,
    email: string,
    actor: { userId: string; role: string },
    kind: InvitationKind,
  ): Promise<InvitationResult> {
    try {
      if (kind !== 'welcome') {
        // EMAIL_EXISTS aquí NO es error: la cuenta pudo crearse a mano y el
        // enlace ocurre en el primer login.
        await this.accounts.createAccount(email)
      }

      await this.accounts.sendPasswordReset(email)
      await this.repo.journal(userId, 'STAFF_USER_INVITATION_SENT', actor, { email, kind })

      return { sent: true }
    } catch (error) {
      const code = error instanceof FirebaseAccountsError ? error.code : 'UNKNOWN'
      const detail = error instanceof FirebaseAccountsError ? error.detail : String(error)

      this.logger.warn(`La invitación a ${email} no salió: ${detail}`)

      try {
        // El detalle completo, no el codigo cortado: el journal es donde se
        // diagnostica esto despues.
        await this.repo.journal(userId, 'STAFF_USER_INVITATION_FAILED', actor, {
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

  private async resolveRole(roleCode: string): Promise<string> {
    if ((HOTEL_ROLES as readonly string[]).includes(roleCode)) {
      throw new UnprocessableEntityException({
        code: 'USE_HOTEL_USERS',
        message: `${roleCode} es un rol del hotel: su alta es POST /hotels/:hotelId/users`,
      })
    }

    const role = await this.repo.roleByCode(roleCode)

    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: `El rol ${roleCode} no existe`,
      })
    }

    return role.id
  }

  private async assertReportsTo(userId: string): Promise<void> {
    if (!(await this.repo.activeUser(userId))) {
      throw new UnprocessableEntityException({
        code: 'SUPERVISOR_NOT_FOUND',
        message: 'A quien reporta no existe o está inactivo',
      })
    }
  }
}

function withInvitation(
  entity: StaffUserEntity,
  invitation: InvitationResult,
): StaffUserWithInvitation {
  return {
    ...entity,
    invitationSent: invitation.sent,
    ...(invitation.error ? { invitationError: invitation.error } : {}),
  }
}

function toEntity(row: StaffUserRow, photos: Map<string, string | null>): StaffUserEntity {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    reportsToUserId: row.reportsToUserId,
    photoUrl: row.photoPath ? (photos.get(row.photoPath) ?? null) : null,
    hasAccount: row.firebaseUid !== null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  }
}
