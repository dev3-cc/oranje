import { Injectable, NotFoundException } from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { PrismaService } from '../../../infra/prisma/index.js'
import { DocumentsService } from '../documents/documents.service.js'
import type { DocumentEntity } from '../documents/documents.service.js'
import type { UpdateWorkerDto } from '../workers/dto/create-worker.dto.js'
import type { WorkerEntity } from '../workers/entities/worker.entity.js'
import { WorkersService } from '../workers/workers.service.js'

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
  ) {}

  // La ficha trae el plazo: el aviso interceptor del dia 4 lo pinta el front
  // con esto, sin una llamada aparte.
  async get(user: AuthenticatedUser): Promise<WorkerEntity & { taxDeadline: TaxDeadline }> {
    const worker = await this.worker(user)

    return {
      ...(await this.workers.get(worker.id)),
      taxDeadline: await this.deadline.of(worker.id, worker.createdAt),
    }
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

  async completeSignup(dto: UpdateWorkerDto, user: AuthenticatedUser): Promise<WorkerEntity> {
    return this.workers.update(await this.workerId(user), dto, user)
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

  private async worker(user: AuthenticatedUser): Promise<{ id: string; createdAt: Date }> {
    const row = await this.prisma.worker.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true, createdAt: true },
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
