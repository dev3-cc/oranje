import { Trans, useLingui } from '@lingui/react/macro'
import { toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import { usePayConsolidationMutation } from '../api/settlementApi'
import { money } from '../lib/settlementFormat'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { apiErrorMessage } from '@/shared/lib/apiError'

/**
 * "Registrar pago" con su modal de confirmación — es terminal, PAID no tiene
 * vuelta, así que no se dispara al primer clic (Hugo, 2026-10-13). Extraído
 * de `ConsolidationDetailPage` para que el Timesheet de Contabilidad use el
 * mismo botón y el mismo texto, no una segunda copia.
 */
export function PayConsolidationButton({
  consolidationId,
  workerName,
  netAmount,
  compact = false,
}: {
  consolidationId: string
  workerName: string
  /** Cadena decimal: el dinero no pasa por `number` en el cliente. */
  netAmount: string
  /** La tabla de filas (Hugo, 2026-10-13) no tiene el ancho del botón largo
      del detalle — mismo botón, texto corto. */
  compact?: boolean
}): ReactNode {
  const { t } = useLingui()
  const [isConfirming, setIsConfirming] = useState(false)
  const [pay, { isLoading }] = usePayConsolidationMutation()

  async function confirm(): Promise<void> {
    setIsConfirming(false)
    try {
      await pay(consolidationId).unwrap()
      toast.success(t`Pago registrado`)
    } catch (error) {
      toast.error(apiErrorMessage(error, { fallback: t`No se pudo registrar el pago. Reintenta.` }))
    }
  }

  return (
    <>
      <Button
        variant="primary"
        disabled={isLoading}
        onClick={() => {
          setIsConfirming(true)
        }}
        className={compact ? 'px-2.5 py-1 text-xs' : undefined}
      >
        {compact ? <Trans>Pagar</Trans> : <Trans>Registrar pago</Trans>}
      </Button>

      <Modal
        isOpen={isConfirming}
        onClose={() => {
          setIsConfirming(false)
        }}
        title={t`¿Registrar el pago de ${workerName}?`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIsConfirming(false)
              }}
            >
              <Trans>Cancelar</Trans>
            </Button>
            <Button
              variant="primary"
              disabled={isLoading}
              onClick={() => {
                void confirm()
              }}
            >
              <Trans>Sí, registrar pago</Trans>
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          <Trans>
            Se registran <span className="font-semibold text-ink">{money(netAmount)}</span> como
            pagados a {workerName}. No se puede deshacer ni editar desde aquí: si algo cambia
            después, el ajuste va en otra semana.
          </Trans>
        </p>
      </Modal>
    </>
  )
}
