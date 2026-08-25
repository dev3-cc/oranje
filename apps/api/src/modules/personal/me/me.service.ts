import { Injectable, NotFoundException } from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { PrismaService } from '../../../infra/prisma/index.js'
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
