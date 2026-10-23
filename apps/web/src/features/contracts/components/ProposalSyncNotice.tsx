import { Trans, useLingui } from '@lingui/react/macro'
import { toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import { useSyncContractProposalMutation } from '../api/contractsApi'
import type { ContractDetail } from '../types/contract.types'

import personajeRetro from '@/assets/ilustrations/personaje-retroalimentacion.svg'
import { BlockedAction } from '@/shared/components/BlockedAction'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { apiErrorMessage } from '@/shared/lib/apiError'

/**
 * El contrato quedó atrás de la propuesta (Hugo, 2026-10-23, Villa Magna):
 * se corrigió la propuesta con una versión nueva y el contrato seguía con las
 * tarifas de la vieja, sin decirlo. Al enviar una versión, el borrador que aún
 * no se envía la toma solo; este aviso cubre los demás casos —el borrador ya
 * enviado, o la versión que salió antes de que existiera esto— con un botón
 * para traer las tarifas nuevas.
 */
export function ProposalSyncNotice({
  contract,
  canEdit,
  isLocked,
}: {
  contract: ContractDetail
  /** `terms_and_conditions:update`, el mismo permiso que editar las tarifas. */
  canEdit: boolean
  isLocked: boolean
}): ReactNode {
  const { t } = useLingui()
  const [isConfirmOpen, setConfirmOpen] = useState(false)
  const [syncProposal, { isLoading }] = useSyncContractProposalMutation()

  const current = contract.proposal
  const latest = contract.latestProposal

  if (
    contract.status !== 'DRAFT' ||
    current === null ||
    latest === null ||
    latest.version <= current.version
  ) {
    return null
  }

  const currentVersion = current.version
  const latestVersion = latest.version
  const blockers = isLocked
    ? [t`Ya se le envió al hotel y está bloqueado: desbloquéalo primero.`]
    : []

  async function confirmSync(): Promise<void> {
    try {
      await syncProposal({ contractId: contract.id }).unwrap()
      setConfirmOpen(false)
      toast.success(t`El contrato ya tiene las tarifas de la v${String(latestVersion)}`)
    } catch (error) {
      toast.error(
        apiErrorMessage(error, {
          byCode: {
            CONTRACT_LOCKED: t`Está bloqueado: desbloquéalo primero.`,
            CONTRACT_PROPOSAL_CURRENT: t`El contrato ya tenía las tarifas de la última propuesta.`,
          },
          fallback: t`No se pudo actualizar. Reintenta en unos segundos.`,
        }),
      )
    }
  }

  return (
    <>
      <NoticeCard
        image={personajeRetro}
        tone="warning"
        role="status"
        title={t`La propuesta cambió después de este contrato`}
        action={
          canEdit ? (
            <BlockedAction reasons={blockers} title={t`Antes de actualizar:`}>
              <Button
                variant="primary"
                disabled={blockers.length > 0 || isLoading}
                onClick={() => {
                  setConfirmOpen(true)
                }}
              >
                <Trans>Actualizar con la v{latestVersion}</Trans>
              </Button>
            </BlockedAction>
          ) : undefined
        }
      >
        <Trans>
          Este contrato tiene las tarifas de la propuesta v{currentVersion}, pero la última enviada
          es la v{latestVersion}.
        </Trans>
      </NoticeCard>

      <Modal
        isOpen={isConfirmOpen}
        onClose={() => {
          setConfirmOpen(false)
        }}
        title={t`¿Actualizar las tarifas con la v${String(latestVersion)}?`}
        description={t`Las tarifas del contrato se reemplazan por las de la v${String(latestVersion)}. Los datos del documento, la vigencia y los multiplicadores no cambian.`}
        footer={
          <>
            <Button
              disabled={isLoading}
              onClick={() => {
                setConfirmOpen(false)
              }}
            >
              <Trans>Cancelar</Trans>
            </Button>
            <Button
              variant="primary"
              disabled={isLoading}
              onClick={() => {
                void confirmSync()
              }}
            >
              {isLoading ? <Trans>Actualizando…</Trans> : <Trans>Sí, actualizar</Trans>}
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    </>
  )
}
