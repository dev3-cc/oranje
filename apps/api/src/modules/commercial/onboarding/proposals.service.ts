import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import type { CreateProposalDto } from './dto/create-proposal.dto.js'
import type { ProposalEntity } from './entities/proposal.entity.js'
import { ProposalRow, ProposalsRepository, type RateInput } from './proposals.repository.js'

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

    const rates = dto.rates ?? []

    await this.assertRates(rates)

    return toEntity(
      await this.repo.create({
        prospectId,
        servicesNote: dto.servicesNote ?? null,
        rates,
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

    /* `undefined` = el PATCH no trae cuadro y se queda como está; un arreglo
       vacío sí lo vacía, que es lo que pide quien borra todos los renglones. */
    const rates = dto.rates ?? null

    await this.assertRates(rates ?? [])

    return toEntity(
      await this.repo.update({
        prospectId,
        proposalId,
        servicesNote: dto.servicesNote ?? null,
        rates,
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

    /* El cuadro de tarifas ES la propuesta: sin un solo puesto cotizado no hay
       nada que el hotel pueda aceptar. Las versiones anteriores al cuadro
       llevaban una tarifa global y siguen siendo válidas. */
    if (proposal.rates.length === 0 && proposal.payRate === null) {
      throw new UnprocessableEntityException({
        code: 'PROPOSAL_WITHOUT_RATES',
        message: 'Agrega al menos un puesto con su tarifa antes de enviar la propuesta',
      })
    }

    return toEntity(
      await this.repo.send({ prospectId, proposalId, userId: user.id, roleCode: user.roleCode }),
    )
  }

  // Sin assertOpen a proposito: el caso que resuelve es "lo abri por error y el
  // ciclo ya avanzo", y exigir Verde o Cafe dejaria el borrador atorado.
  async discardDraft(
    prospectId: string,
    proposalId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    await this.prospect(prospectId)

    const proposal = await this.proposal(prospectId, proposalId)

    if (proposal.sentAt !== null) {
      throw new ConflictException({
        code: 'PROPOSAL_SENT',
        message:
          'Lo enviado no se borra: es historia con el hotel. Abre una versión nueva si hay que renegociar.',
      })
    }

    await this.repo.discardDraft({
      prospectId,
      proposalId,
      version: proposal.version,
      userId: user.id,
      roleCode: user.roleCode,
    })
  }

  async hasSent(prospectId: string): Promise<boolean> {
    return (await this.repo.lastSent(prospectId)) !== null
  }

  /**
   * Un renglón por puesto, el puesto tiene que existir en el catálogo, y el
   * hotel nunca paga menos de lo que Oranje le paga al colaborador. Mismos
   * códigos de error que el Documento de T&C, porque es el mismo cuadro.
   */
  private async assertRates(rates: RateInput[]): Promise<void> {
    /* El CHECK de la tabla exige tarifas positivas; sin esto un "0" pasaba las
       validaciones y reventaba como error crudo del motor en vez de 422. */
    const zero = rates.find((r) => Number(r.payRate) <= 0 || Number(r.billRate) <= 0)

    if (zero) {
      throw new UnprocessableEntityException({
        code: 'RATE_NOT_POSITIVE',
        message: 'Las tarifas de un puesto tienen que ser mayores que cero',
        details: [{ field: 'catalogPositionId', value: zero.catalogPositionId }],
      })
    }

    const backwards = rates.find((r) => Number(r.billRate) < Number(r.payRate))

    if (backwards) {
      throw new UnprocessableEntityException({
        code: 'RATE_MARGIN_NEGATIVE',
        message: 'Hay un puesto donde el bill rate queda por debajo del pay rate',
        details: [{ field: 'catalogPositionId', value: backwards.catalogPositionId }],
      })
    }

    const ids = rates.map((r) => r.catalogPositionId)

    if (new Set(ids).size !== ids.length) {
      throw new UnprocessableEntityException({
        code: 'RATE_DUPLICATED',
        message: 'Hay dos tarifas para el mismo puesto',
      })
    }

    const found = await this.repo.positionsExist(ids)
    const missing = ids.find((id) => !found.has(id))

    if (missing) {
      throw new UnprocessableEntityException({
        code: 'POSITION_NOT_FOUND',
        message: 'Una de las tarifas apunta a un puesto que no existe en el catálogo',
        details: [{ field: 'catalogPositionId', value: missing }],
      })
    }
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
    rates: row.rates.map((r) => ({
      id: r.id,
      position: r.catalogPosition,
      payRate: r.payRate.toFixed(2),
      billRate: r.billRate.toFixed(2),
    })),
    payRate: row.payRate?.toFixed(4) ?? null,
    billRate: row.billRate?.toFixed(4) ?? null,
    isDraft: row.sentAt === null,
    sentBy: row.sentBy,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? null,
  }
}
