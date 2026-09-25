import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { FirebaseAccountsService } from '../../../infra/firebase/index.js'
import { PrismaService } from '../../../infra/prisma/index.js'
import { NotificationPublisherService } from '../../notifications/index.js'
import { DocumentsService } from '../documents/documents.service.js'
import type { DocumentEntity } from '../documents/documents.service.js'
import type { UpdateWorkerDto } from '../workers/dto/create-worker.dto.js'
import type { WorkerEntity } from '../workers/entities/worker.entity.js'
import { WorkersService } from '../workers/workers.service.js'

import { AccessDeadlineService } from './access-deadline.service.js'
import type { AccessDeadlines } from './access-deadline.service.js'
import type { TaxDeadline } from './tax-deadline.service.js'
import { TaxDeadlineService } from './tax-deadline.service.js'

// El estado que declara la disponibilidad voluntaria (RR-C-02).
const AVAILABLE_VOLUNTARY = 'YELLOW'

// El autoservicio del Colaborador. Ninguna ruta lleva un id en la URL: el
// colaborador sale del token, que es lo que hace cumplir RR-C-01 —no ve datos
// de ningun otro— sin depender de que el cliente mande el suyo.
@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workers: WorkersService,
    private readonly deadline: TaxDeadlineService,
    private readonly documents: DocumentsService,
    private readonly notifications: NotificationPublisherService,
    private readonly accessDeadline: AccessDeadlineService,
    private readonly accounts: FirebaseAccountsService,
  ) {}

  // La ficha trae el plazo: el aviso interceptor del dia 4 lo pinta el front
  // con esto, sin una llamada aparte.
  async get(user: AuthenticatedUser): Promise<
    WorkerEntity & {
      taxDeadline: TaxDeadline
      accessDeadlines: AccessDeadlines
      legacyAccess: { corporateEmail: string } | null
    }
  > {
    const worker = await this.worker(user)
    // Entró con la cuenta de transición (D-XX): avisa cuál es la buena antes
    // de que `deprecates_at` la corte — no todos los que ponchan tienen esta
    // fila, así que null es el caso normal.
    const legacyAccess =
      worker.legacyUserId === user.id && worker.account
        ? { corporateEmail: worker.account.email }
        : null

    return {
      ...(await this.workers.get(worker.id)),
      taxDeadline: await this.deadline.of(worker.id, worker.createdAt),
      accessDeadlines: await this.accessDeadline.of(user.id),
      legacyAccess,
    }
  }

  /**
   * Sustituye la contraseña temporal entregada en mano por la propia. Se
   * escribe en Firebase por uid (la cuenta quedó enlazada desde el alta) y se
   * limpia `temp_password_issued_at`, que es lo que corría el plazo.
   */
  async changePassword(newPassword: string, user: AuthenticatedUser): Promise<void> {
    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { firebaseUid: true },
    })

    if (!account?.firebaseUid) {
      throw new ConflictException({
        code: 'ACCOUNT_NOT_LINKED',
        message: 'La cuenta no está enlazada con Firebase todavía',
      })
    }

    try {
      await this.accounts.setPassword(account.firebaseUid, newPassword)
    } catch {
      throw new ServiceUnavailableException({
        code: 'FIREBASE_UNAVAILABLE',
        message: 'Firebase no respondió; intenta de nuevo',
      })
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { tempPasswordIssuedAt: null, updatedAt: new Date() },
      })
      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'identity.user',
          entityId: user.id,
          eventType: 'PASSWORD_CHANGED',
          actorUserId: user.id,
          actorRole: user.roleCode,
          payload: {},
        },
      })
    })

    // Que el acceso vuelva ya, no cuando expire la cache del guard.
    this.accessDeadline.invalidate(user.id)
  }

  // La misma forma que /workers/:id/history. Sin filas es [] y no 404: un
  // colaborador recien creado no tiene historia todavia, y eso es valido.
  async history(user: AuthenticatedUser): Promise<
    Array<{
      id: string
      fromState: string | null
      toState: string
      reason: string | null
      occurredAt: string
      userName: string
    }>
  > {
    return this.workers.history(await this.workerId(user))
  }

  // El colaborador sube SU documento fiscal (RF-C-01). Nace sin verificar:
  // verificar sigue siendo de la Reclutadora.
  async uploadDocument(
    dto: { documentType: 'SSN_ITIN'; filePath: string },
    user: AuthenticatedUser,
  ): Promise<DocumentEntity> {
    const document = await this.documents.createOwn(await this.workerId(user), dto.filePath, user)

    // Que el acceso vuelva ya, no cuando expire la cache del guard.
    this.deadline.invalidate(user.id)

    return document
  }

  // Fase 2 la llena el propio Colaborador (autoservicio); a quien le toca
  // revisar es "la Reclutadora" que lo dio de alta — `worker.created_by`, que
  // la fila lleva desde que nace y nunca es nulo.
  async completeSignup(dto: UpdateWorkerDto, user: AuthenticatedUser): Promise<WorkerEntity> {
    const worker = await this.worker(user)
    const result = await this.workers.update(worker.id, dto, user)

    // Si con esto el expediente quedó completo, el bloqueo se levanta ya.
    this.accessDeadline.invalidate(user.id)

    try {
      await this.notifications.publish({
        type: 'WORKER_PENDING_REVIEW',
        title: 'Alta pendiente de revisión',
        body: `${worker.fullName} completó su Fase 2 — ya se puede validar.`,
        entity: { type: 'personal.worker', id: worker.id },
        actorUserId: user.id,
        audience: [{ kind: 'USER', userId: worker.createdBy }],
      })
    } catch {
      // Mejor esfuerzo: que Pub/Sub no responda no revierte el guardado.
    }

    return result
  }

  async updateContact(dto: UpdateWorkerDto, user: AuthenticatedUser): Promise<WorkerEntity> {
    return this.workers.update(await this.workerId(user), dto, user)
  }

  // Activar Amarillo es autoservicio y sin aprobacion, pero quien decide si se
  // puede no es este metodo: es la tabla de transiciones, que ya trae las tres
  // de origen (Verde fuerte, Naranja y Rosa) autorizadas a ROL-C-01.
  async setAvailable(user: AuthenticatedUser): Promise<WorkerEntity> {
    return this.workers.changeState(
      await this.workerId(user),
      { toState: AVAILABLE_VOLUNTARY },
      user,
    )
  }

  private async workerId(user: AuthenticatedUser): Promise<string> {
    return (await this.worker(user)).id
  }

  private async worker(user: AuthenticatedUser): Promise<{
    id: string
    fullName: string
    createdAt: Date
    createdBy: string
    legacyUserId: string | null
    account: { email: string } | null
  }> {
    const row = await this.prisma.worker.findFirst({
      where: { OR: [{ userId: user.id }, { legacyUserId: user.id }], deletedAt: null },
      select: {
        id: true,
        fullName: true,
        createdAt: true,
        createdBy: true,
        legacyUserId: true,
        account: { select: { email: true } },
      },
    })

    if (!row) {
      throw new NotFoundException({
        code: 'WORKER_NOT_LINKED',
        message: 'Tu cuenta no está ligada a un colaborador',
      })
    }

    return row
  }
}
