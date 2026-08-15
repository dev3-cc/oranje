import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { PrismaService } from '../../../infra/prisma/index.js'

import type { CreateTransitionDto } from './dto/create-transition.dto.js'
import type { HistoryEntryEntity, TransitionOptionEntity } from './entities/transition.entity.js'
import { TransicionPermitida, TransitionsRepository } from './transitions.repository.js'

const ESTADO_CLIENTE = 'ORANGE'

@Injectable()
export class TransitionsService {
  constructor(
    private readonly repo: TransitionsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async available(prospectId: string, user: AuthenticatedUser): Promise<TransitionOptionEntity[]> {
    const prospecto = await this.prospecto(prospectId)
    const pasos = await this.repo.desde(prospecto.onboardingStateId)

    const mios = pasos.filter((p) => p.roleCode === user.roleCode)
    const resueltos = await Promise.all(mios.map((p) => this.resolverDestino(prospectId, p)))

    return resueltos
      .filter(
        (
          r,
        ): r is {
          paso: TransicionPermitida
          code: string
          name: string
          color: string
          isBranch: boolean
        } => r !== null,
      )
      .map((r) => ({
        toState: { code: r.code, color: r.color, name: r.name, isBranch: r.isBranch },
        requiresReason: r.paso.requiresReason,
        requiresEvidence: r.paso.requiresEvidence,
      }))
  }

  async history(prospectId: string): Promise<HistoryEntryEntity[]> {
    await this.prospecto(prospectId)

    return (await this.repo.historia(prospectId)).map((h) => ({
      id: h.id,
      fromState: h.fromState,
      toState: h.toState,
      reason: h.reason,
      user: h.user,
      occurredAt: h.occurredAt.toISOString(),
    }))
  }

  async apply(
    prospectId: string,
    dto: CreateTransitionDto,
    user: AuthenticatedUser,
  ): Promise<{ from: string; to: string }> {
    const prospecto = await this.prospecto(prospectId)

    if (prospecto.closedAt !== null) {
      throw new ConflictException({
        code: 'PROSPECT_CLOSED',
        message: 'El ciclo comercial está cerrado',
      })
    }

    const pasos = await this.repo.desde(prospecto.onboardingStateId)
    const candidatos = await this.candidatosHacia(prospectId, pasos, dto.toState)

    if (candidatos.length === 0) {
      const posibles = await this.codigosPosibles(prospectId, pasos)

      throw new ConflictException({
        code: 'TRANSITION_NOT_ALLOWED',
        message: `No se puede pasar de ${prospecto.state.code} a ${dto.toState}`,
        details: posibles.map((code) => ({ field: 'toState', value: code })),
      })
    }

    const paso = candidatos.find((c) => c.roleCode === user.roleCode)

    if (!paso) {
      throw new ForbiddenException({
        code: 'TRANSITION_FORBIDDEN',
        message: `Tu rol no puede pasar este prospecto a ${dto.toState}`,
        details: candidatos.map((c) => ({ field: 'authorizedRole', value: c.roleCode })),
      })
    }

    let reasonId: string | null = null

    if (paso.requiresReason) {
      if (!dto.reasonCode) {
        throw new UnprocessableEntityException({
          code: 'REASON_REQUIRED',
          message: `Pasar a ${dto.toState} exige un motivo`,
        })
      }

      const motivo = await this.repo.motivoPorCode(dto.reasonCode)

      if (!motivo) {
        throw new UnprocessableEntityException({
          code: 'REASON_NOT_FOUND',
          message: `El motivo ${dto.reasonCode} no existe en el Semáforo Onboarding`,
        })
      }

      reasonId = motivo.id
    }

    const destino = await this.resolverDestino(prospectId, paso)

    if (!destino) {
      throw new ConflictException({
        code: 'PREVIOUS_STATE_UNKNOWN',
        message: 'No hay un estado previo al que regresar',
      })
    }

    if (destino.code === ESTADO_CLIENTE) {
      await this.assertUsuarioDelHotel(prospecto.hotelId)
    }

    await this.repo.aplicar({
      prospectId,
      fromStateId: prospecto.onboardingStateId,
      toStateId: destino.paso.toStateId ?? (await this.idDe(destino.code)),
      toStateCode: destino.code,
      reasonId,
      note: dto.note ?? null,
      userId: user.id,
      roleCode: user.roleCode,
    })

    return { from: prospecto.state.code, to: destino.code }
  }

  private async assertUsuarioDelHotel(hotelId: string): Promise<void> {
    const cuantos = await this.prisma.user.count({ where: { hotelId, isActive: true } })

    if (cuantos === 0) {
      throw new UnprocessableEntityException({
        code: 'HOTEL_USER_REQUIRED',
        message: 'Antes de convertir al hotel en cliente hay que crear su Usuario del Hotel',
      })
    }
  }

  private async prospecto(id: string): Promise<{
    id: string
    hotelId: string
    onboardingStateId: string
    closedAt: Date | null
    state: { code: string }
  }> {
    const row = await this.prisma.prospect.findUnique({
      where: { id },
      select: {
        id: true,
        hotelId: true,
        onboardingStateId: true,
        closedAt: true,
        onboardingState: { select: { code: true } },
      },
    })

    if (!row) {
      throw new NotFoundException({ code: 'PROSPECT_NOT_FOUND', message: 'El prospecto no existe' })
    }

    return { ...row, state: row.onboardingState }
  }

  private async candidatosHacia(
    prospectId: string,
    pasos: TransicionPermitida[],
    toState: string,
  ): Promise<TransicionPermitida[]> {
    const resueltos = await Promise.all(
      pasos.map(async (p) => ({ paso: p, destino: await this.resolverDestino(prospectId, p) })),
    )

    return resueltos.filter((r) => r.destino?.code === toState).map((r) => r.paso)
  }

  private async codigosPosibles(
    prospectId: string,
    pasos: TransicionPermitida[],
  ): Promise<string[]> {
    const resueltos = await Promise.all(pasos.map((p) => this.resolverDestino(prospectId, p)))

    return [...new Set(resueltos.filter((r) => r !== null).map((r) => r.code))]
  }

  private async resolverDestino(
    prospectId: string,
    paso: TransicionPermitida,
  ): Promise<{
    paso: TransicionPermitida
    code: string
    name: string
    color: string
    isBranch: boolean
  } | null> {
    if (!paso.returnsToPrevious) {
      return paso.toState
        ? {
            paso,
            code: paso.toState.code,
            name: paso.toState.name,
            color: paso.toState.color,
            isBranch: paso.toState.isBranch,
          }
        : null
    }

    const previo = await this.repo.estadoPrevio(prospectId)

    if (!previo) {
      return null
    }

    const estado = await this.prisma.statusLightState.findUniqueOrThrow({
      where: { id: previo.id },
      select: { code: true, name: true, color: true, isBranch: true },
    })

    return { paso, ...estado }
  }

  private async idDe(code: string): Promise<string> {
    const estado = await this.repo.estadoPorCode(code)

    if (!estado) {
      throw new ConflictException({
        code: 'STATE_NOT_FOUND',
        message: `El estado ${code} no existe`,
      })
    }

    return estado.id
  }
}
