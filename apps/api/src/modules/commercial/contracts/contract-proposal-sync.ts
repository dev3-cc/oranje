import type { Prisma } from '@prisma/client'
import { v7 as uuidv7 } from 'uuid'

/**
 * El borrador del contrato sigue a la propuesta (Hugo, 2026-10-23): se
 * corrigió la propuesta con una versión nueva, se envió, y el contrato seguía
 * con las tarifas de la versión vieja — era una copia hecha al crearlo que
 * nunca volvía a mirar la propuesta.
 *
 * Copia el cuadro de tarifas de esa versión al contrato y lo deja apuntando a
 * ella. Solo las tarifas: los datos del documento (propiedad, correos) se
 * editan en el contrato y no se pisan. Corre dentro de la transacción de quien
 * la llama: al enviar la propuesta, o al pedirlo desde el contrato.
 */
export async function syncContractRatesFromProposal(
  tx: Prisma.TransactionClient,
  params: { contractId: string; proposalId: string; userId: string; roleCode: string },
): Promise<void> {
  const proposal = await tx.proposal.findUniqueOrThrow({
    where: { id: params.proposalId },
    select: { version: true },
  })
  const rates = await tx.proposalRate.findMany({
    where: { proposalId: params.proposalId },
    select: { catalogPositionId: true, payRate: true, billRate: true },
  })

  await tx.contractRate.deleteMany({ where: { contractId: params.contractId } })

  for (const rate of rates) {
    await tx.contractRate.create({
      data: {
        id: uuidv7(),
        contractId: params.contractId,
        catalogPositionId: rate.catalogPositionId,
        payRate: rate.payRate,
        billRate: rate.billRate,
      },
    })
  }

  await tx.contract.update({
    where: { id: params.contractId },
    data: { proposalId: params.proposalId, updatedAt: new Date() },
  })

  await tx.journalEntry.create({
    data: {
      id: uuidv7(),
      entityType: 'commercial.contract',
      entityId: params.contractId,
      eventType: 'CONTRACT_RATES_FROM_PROPOSAL',
      actorUserId: params.userId,
      actorRole: params.roleCode,
      payload: {
        proposalId: params.proposalId,
        version: proposal.version,
        rates: rates.length,
      },
    },
  })
}
