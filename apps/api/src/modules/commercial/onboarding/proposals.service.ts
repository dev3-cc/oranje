import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import type { CreateProposalDto } from './dto/create-proposal.dto.js'
import type { ProposalEntity } from './entities/proposal.entity.js'
import { ProposalRow, ProposalsRepository } from './proposals.repository.js'

const WORKING_STATES = ['GREEN', 'BROWN']

@Injectable()
export class ProposalsService {
  constructor(private readonly repo: ProposalsRepository) {}

  async listAcross(
    ownerUserId: string | null,
    onlyDrafts: boolean,
  ): Promise<Array<ProposalEntity & { prospectId: string; hotelName: string }>> {
    const rows = await this.repo.listAcrossProspects({ ownerUserId, onlyDrafts })

    return rows.map((r) => ({ ...toEntity(r), prospectId: r.prospectId, hotelName: r.hotelName }))
  }

  async list(prospectId: string): Promise<ProposalEntity[]> {
    await this.prospect(prospectId)

    return (await this.repo.listAll(prospectId)).map(toEntity)
  }

  async create(
    prospectId: string,
    dto: CreateProposalDto,
    user: AuthenticatedUser,
  ): Promise<ProposalEntity> {
    await this.assertOpen(prospectId)

    const draft = await this.repo.openDraft(prospectId)

    if (draft) {
      throw new ConflictException({
        code: 'PROPOSAL_DRAFT_EXISTS',
        message: `La versión ${draft.version} sigue en borrador: envíala o edítala antes de crear otra`,
        details: [{ field: 'proposalId', value: draft.id }],
      })
    }

    return toEntity(
      await this.repo.create({
        prospectId,
        servicesNote: dto.servicesNote ?? null,
        payRate: dto.payRate ?? null,
        billRate: dto.billRate ?? null,
        userId: user.id,
        roleCode: user.roleCode,
      }),
    )
  }

  async update(
    prospectId: string,
    proposalId: string,
    dto: CreateProposalDto,
    user: AuthenticatedUser,
  ): Promise<ProposalEntity> {
    await this.assertOpen(prospectId)

    const proposal = await this.proposal(prospectId, proposalId)

    if (proposal.sentAt !== null) {
      throw new ConflictException({
        code: 'PROPOSAL_ALREADY_SENT',
        message: 'Una propuesta enviada no se edita: crea una versión nueva',
      })
    }

    return toEntity(
      await this.repo.update({
        prospectId,
        proposalId,
        servicesNote: dto.servicesNote ?? null,
        payRate: dto.payRate ?? null,
        billRate: dto.billRate ?? null,
        userId: user.id,
        roleCode: user.roleCode,
      }),
    )
  }

  async send(
    prospectId: string,
    proposalId: string,
    user: AuthenticatedUser,
  ): Promise<ProposalEntity> {
    await this.assertOpen(prospectId)

    const proposal = await this.proposal(prospectId, proposalId)

    if (proposal.sentAt !== null) {
      throw new ConflictException({
        code: 'PROPOSAL_ALREADY_SENT',
        message: `La versión ${proposal.version} ya se envió`,
      })
    }

    return toEntity(
      await this.repo.send({ prospectId, proposalId, userId: user.id, roleCode: user.roleCode }),
    )
  }

  async hasSent(prospectId: string): Promise<boolean> {
    return (await this.repo.lastSent(prospectId)) !== null
  }

  private async assertOpen(prospectId: string): Promise<void> {
    const prospect = await this.prospect(prospectId)

    if (prospect.closedAt !== null) {
      throw new ConflictException({
        code: 'PROSPECT_CLOSED',
        message: 'El ciclo comercial está cerrado',
      })
    }

    if (!WORKING_STATES.includes(prospect.stateCode)) {
      throw new UnprocessableEntityException({
        code: 'PROPOSAL_STATE_INVALID',
        message: `La propuesta se trabaja en Verde o Café, no en ${prospect.stateCode}`,
      })
    }
  }

  private async prospect(
    id: string,
  ): Promise<{ id: string; hotelId: string; closedAt: Date | null; stateCode: string }> {
    const row = await this.repo.prospect(id)

    if (!row) {
      throw new NotFoundException({ code: 'PROSPECT_NOT_FOUND', message: 'El prospecto no existe' })
    }

    return row
  }

  private async proposal(prospectId: string, proposalId: string): Promise<ProposalRow> {
    const row = await this.repo.findById(prospectId, proposalId)

    if (!row) {
      throw new NotFoundException({
        code: 'PROPOSAL_NOT_FOUND',
        message: 'La propuesta no existe en este ciclo comercial',
      })
    }

    return row
  }
}

function toEntity(row: ProposalRow): ProposalEntity {
  return {
    id: row.id,
    version: row.version,
    servicesNote: row.servicesNote,
    payRate: row.payRate?.toFixed(4) ?? null,
    billRate: row.billRate?.toFixed(4) ?? null,
    isDraft: row.sentAt === null,
    sentBy: row.sentBy,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? null,
  }
}
