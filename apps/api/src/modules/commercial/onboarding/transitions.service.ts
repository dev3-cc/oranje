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
import { ProposalsService } from './proposals.service.js'
import { AllowedTransition, TransitionsRepository } from './transitions.repository.js'

const CLIENT_STATE = 'ORANGE'
const PROPOSAL_STATE = 'GREEN'

@Injectable()
export class TransitionsService {
  constructor(
    private readonly repo: TransitionsRepository,
    private readonly prisma: PrismaService,
    private readonly proposals: ProposalsService,
  ) {}

  async available(prospectId: string, user: AuthenticatedUser): Promise<TransitionOptionEntity[]> {
    const prospect = await this.prospect(prospectId)
    const steps = await this.repo.stepsFrom(prospect.onboardingStateId)

    const mine = steps.filter((p) => p.roleCode === user.roleCode)
    const resolved = await Promise.all(mine.map((p) => this.resolveTarget(prospectId, p)))

    return resolved
      .filter(
        (
          r,
        ): r is {
          step: AllowedTransition
          code: string
          name: string
          color: string
          isBranch: boolean
        } => r !== null,
      )
      .map((r) => ({
        toState: { code: r.code, color: r.color, name: r.name, isBranch: r.isBranch },
        requiresReason: r.step.requiresReason,
        requiresEvidence: r.step.requiresEvidence,
      }))
  }

  async history(prospectId: string): Promise<HistoryEntryEntity[]> {
    await this.prospect(prospectId)

    return (await this.repo.historyOf(prospectId)).map((h) => ({
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
    const prospect = await this.prospect(prospectId)

    if (prospect.closedAt !== null) {
      throw new ConflictException({
        code: 'PROSPECT_CLOSED',
        message: 'El ciclo comercial está cerrado',
      })
    }

    const steps = await this.repo.stepsFrom(prospect.onboardingStateId)
    const candidates = await this.candidatesTo(prospectId, steps, dto.toState)

    if (candidates.length === 0) {
      const posibles = await this.possibleCodes(prospectId, steps)

      throw new ConflictException({
        code: 'TRANSITION_NOT_ALLOWED',
        message: `No se puede pasar de ${prospect.state.code} a ${dto.toState}`,
        details: posibles.map((code) => ({ field: 'toState', value: code })),
      })
    }

    const step = candidates.find((c) => c.roleCode === user.roleCode)

    if (!step) {
      throw new ForbiddenException({
        code: 'TRANSITION_FORBIDDEN',
        message: `Tu rol no puede pasar este prospecto a ${dto.toState}`,
        details: candidates.map((c) => ({ field: 'authorizedRole', value: c.roleCode })),
      })
    }

    let reasonId: string | null = null

    if (step.requiresReason) {
      if (!dto.reasonCode) {
        throw new UnprocessableEntityException({
          code: 'REASON_REQUIRED',
          message: `Pasar a ${dto.toState} exige un motivo`,
        })
      }

      const reason = await this.repo.reasonByCode(dto.reasonCode)

      if (!reason) {
        throw new UnprocessableEntityException({
          code: 'REASON_NOT_FOUND',
          message: `El motivo ${dto.reasonCode} no existe en el Semáforo Onboarding`,
        })
      }

      reasonId = reason.id
    }

    const target = await this.resolveTarget(prospectId, step)

    if (!target) {
      throw new ConflictException({
        code: 'PREVIOUS_STATE_UNKNOWN',
        message: 'No hay un estado previo al que regresar',
      })
    }

    if (target.code === CLIENT_STATE) {
      await this.assertHotelUser(prospect.hotelId)
    }

    if (prospect.state.code === PROPOSAL_STATE) {
      await this.assertSentProposal(prospectId)
    }

    await this.repo.applyChange({
      prospectId,
      fromStateId: prospect.onboardingStateId,
      toStateId: target.step.toStateId ?? (await this.idOf(target.code)),
      toStateCode: target.code,
      reasonId,
      note: dto.note ?? null,
      userId: user.id,
      roleCode: user.roleCode,
    })

    return { from: prospect.state.code, to: target.code }
  }

  private async assertSentProposal(prospectId: string): Promise<void> {
    if (!(await this.proposals.hasSent(prospectId))) {
      throw new UnprocessableEntityException({
        code: 'PROPOSAL_REQUIRED',
        message: 'Verde no se abandona sin enviar la Propuesta Personalizada',
      })
    }
  }

  private async assertHotelUser(hotelId: string): Promise<void> {
    const howMany = await this.prisma.user.count({ where: { hotelId, isActive: true } })

    if (howMany === 0) {
      throw new UnprocessableEntityException({
        code: 'HOTEL_USER_REQUIRED',
        message: 'Antes de convertir al hotel en cliente hay que crear su Usuario del Hotel',
      })
    }
  }

  private async prospect(id: string): Promise<{
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

  private async candidatesTo(
    prospectId: string,
    steps: AllowedTransition[],
    toState: string,
  ): Promise<AllowedTransition[]> {
    const resolved = await Promise.all(
      steps.map(async (p) => ({ step: p, target: await this.resolveTarget(prospectId, p) })),
    )

    return resolved.filter((r) => r.target?.code === toState).map((r) => r.step)
  }

  private async possibleCodes(prospectId: string, steps: AllowedTransition[]): Promise<string[]> {
    const resolved = await Promise.all(steps.map((p) => this.resolveTarget(prospectId, p)))

    return [...new Set(resolved.filter((r) => r !== null).map((r) => r.code))]
  }

  private async resolveTarget(
    prospectId: string,
    step: AllowedTransition,
  ): Promise<{
    step: AllowedTransition
    code: string
    name: string
    color: string
    isBranch: boolean
  } | null> {
    if (!step.returnsToPrevious) {
      return step.toState
        ? {
            step,
            code: step.toState.code,
            name: step.toState.name,
            color: step.toState.color,
            isBranch: step.toState.isBranch,
          }
        : null
    }

    const previous = await this.repo.previousState(prospectId)

    if (!previous) {
      return null
    }

    const state = await this.prisma.statusLightState.findUniqueOrThrow({
      where: { id: previous.id },
      select: { code: true, name: true, color: true, isBranch: true },
    })

    return { step, ...state }
  }

  private async idOf(code: string): Promise<string> {
    const state = await this.repo.stateByCode(code)

    if (!state) {
      throw new ConflictException({
        code: 'STATE_NOT_FOUND',
        message: `El estado ${code} no existe`,
      })
    }

    return state.id
  }
}
