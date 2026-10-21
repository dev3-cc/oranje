import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useState, type ReactNode } from 'react'

import { useUnlockContractMutation } from '../api/contractsApi'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { apiErrorMessage } from '@/shared/lib/apiError'

const MIN_REASON_LENGTH = 4

/**
 * Desbloquea un contrato ACTIVO — pide motivo porque reabre un documento ya
 * firmado (mismo criterio que rechazar un documento o corregir una nómina ya
 * hecha); volver a bloquearlo después no lo pide, porque ahí no se arriesga
 * nada (Hugo, 2026-10-21).
 */
export function UnlockContractDialog({
  contractId,
  isOpen,
  onClose,
}: {
  contractId: string
  isOpen: boolean
  onClose: () => void
}): ReactNode {
  const { t } = useLingui()
  const [unlockContract, { isLoading, isError, error }] = useUnlockContractMutation()
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (isOpen) setReason('')
  }, [isOpen])

  const canSubmit = reason.trim().length >= MIN_REASON_LENGTH && !isLoading

  async function submit(): Promise<void> {
    if (!canSubmit) return
    try {
      await unlockContract({ contractId, reason: reason.trim() }).unwrap()
      onClose()
    } catch {
      return
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t`Desbloquear contrato`}
      description={t`Queda registrado en el journal, con este motivo.`}
      className="max-w-md"
      footer={
        <>
          <Button onClick={onClose} disabled={isLoading}>
            <Trans>Cancelar</Trans>
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!canSubmit}>
            {isLoading ? <Trans>Desbloqueando…</Trans> : <Trans>Desbloquear</Trans>}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {isError && (
          <p role="alert" className="text-sm text-red">
            {apiErrorMessage(error, {
              byCode: {
                CONTRACT_NOT_ACTIVE: t`Solo se desbloquea un contrato vigente.`,
              },
              fallback: t`No se pudo desbloquear. Inténtalo de nuevo.`,
            })}
          </p>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-2">
            <Trans>Motivo</Trans>
          </span>
          <textarea
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
            }}
            rows={3}
            placeholder={t`El hotel pidió corregir la dirección de la propiedad`}
            aria-label={t`Motivo`}
            className="w-full resize-none rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none"
          />
        </label>
      </div>
    </Modal>
  )
}
