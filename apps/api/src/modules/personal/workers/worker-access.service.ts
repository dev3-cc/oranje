import { randomBytes } from 'node:crypto'

import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { CPanelError, CPanelService } from '../../../infra/cpanel/index.js'
import { FirebaseAccountsError, FirebaseAccountsService } from '../../../infra/firebase/index.js'
import { PrismaService } from '../../../infra/prisma/index.js'

const WORKER_ROLE = 'ROL-C-01'

/** Lo que se muestra UNA sola vez a quien dio el alta; nunca se vuelve a leer. */
export interface WorkerAccessCredential {
  email: string
  password: string
  /**
   * El buzón real es de un tercero (cPanel) y puede fallar sin que la cuenta
   * de Oranje deje de existir: `created` en false con el motivo, y el
   * Administrador lo crea después desde Correos corporativos.
   */
  mailbox: { created: true } | { created: false; reason: string }
}

/**
 * Reglas de Negocio § Acceso del Colaborador. El alta del Pool crea el
 * acceso completo: la cuenta de Oranje (`identity.user` con rol Colaborador +
 * Firebase Auth) y el buzón @oranjepeople.com, con UNA contraseña temporal
 * generada aquí que se entrega en mano. Nada viaja por correo: el buzón al
 * que llegaría es justo el que se está creando (era un bucle). La persona
 * entra con ese correo y tiene 3 días para cambiar la contraseña desde su app.
 */
@Injectable()
export class WorkerAccessService {
  private readonly logger = new Logger(WorkerAccessService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: FirebaseAccountsService,
    private readonly cpanel: CPanelService,
  ) {}

  /** El dominio del buzón, para que el front proponga el correo sin adivinarlo. */
  get domainName(): string {
    return this.cpanel.domainName
  }

  async create(
    workerId: string,
    localPart: string,
    actor: AuthenticatedUser,
  ): Promise<WorkerAccessCredential> {
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, deletedAt: null },
      select: { id: true, fullName: true, userId: true },
    })

    if (!worker) {
      throw new NotFoundException({ code: 'WORKER_NOT_FOUND', message: 'El colaborador no existe' })
    }

    if (worker.userId !== null) {
      throw new ConflictException({
        code: 'ACCESS_ALREADY_CREATED',
        message: 'Este colaborador ya tiene acceso; restablece la contraseña en vez de crear otro',
      })
    }

    const email = `${localPart}@${this.cpanel.domainName}`.toLowerCase()

    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictException({
        code: 'EMAIL_TAKEN',
        message: `Ya existe un usuario con el correo ${email}`,
      })
    }

    const role = await this.prisma.role.findUnique({
      where: { code: WORKER_ROLE },
      select: { id: true },
    })

    if (!role) {
      throw new ServiceUnavailableException({
        code: 'ROLE_NOT_SEEDED',
        message: 'El rol del Colaborador no está sembrado',
      })
    }

    const password = generatePassword()

    // La cuenta de Firebase va ANTES de la fila: si el correo ya existe allá,
    // no nace nada aquí (mismo criterio que el alta de personal con contraseña).
    let uid: string

    try {
      uid = await this.accounts.createAccountWithPassword(email, password)
    } catch (error) {
      const code = error instanceof FirebaseAccountsError ? error.code : 'UNKNOWN'

      if (code === 'EMAIL_EXISTS') {
        throw new ConflictException({
          code: 'EMAIL_TAKEN',
          message: `Ya existe una cuenta con el correo ${email}`,
        })
      }

      this.logger.error(`Firebase no pudo crear la cuenta del colaborador: ${code}`)

      throw new ServiceUnavailableException({
        code: 'FIREBASE_UNAVAILABLE',
        message: 'Firebase no respondió; intenta de nuevo',
      })
    }

    const now = new Date()
    const userId = uuidv7()

    await this.prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          email,
          fullName: worker.fullName,
          roleId: role.id,
          firebaseUid: uid,
          tempPasswordIssuedAt: now,
        },
      })

      await tx.worker.update({
        where: { id: worker.id },
        data: { userId, updatedAt: now },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'personal.worker',
          entityId: worker.id,
          eventType: 'WORKER_ACCESS_CREATED',
          actorUserId: actor.id,
          actorRole: actor.roleCode,
          // La contraseña JAMÁS va al journal.
          payload: { email, userId },
        },
      })
    })

    return { email, password, mailbox: await this.createMailbox(localPart, password) }
  }

  /**
   * La misma contraseña para el buzón: una sola cosa que aprenderse. Si cPanel
   * no responde (en staging su IP no está autorizada) la cuenta ya existe y
   * la respuesta lo dice; no se revierte nada.
   */
  private async createMailbox(
    localPart: string,
    password: string,
  ): Promise<WorkerAccessCredential['mailbox']> {
    try {
      await this.cpanel.createMailbox(localPart, password)

      return { created: true }
    } catch (error) {
      const reason = error instanceof CPanelError ? error.message : 'cPanel no respondió'

      this.logger.warn(`El buzón de ${localPart} no se creó: ${reason}`)

      return { created: false, reason }
    }
  }
}

/** 16 caracteres URL-safe; el mismo generador que Correos corporativos. */
function generatePassword(): string {
  return randomBytes(12).toString('base64url')
}
