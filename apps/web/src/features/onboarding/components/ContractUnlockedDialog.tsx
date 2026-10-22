import { useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'

import personajeContratacion from '@/assets/ilustrations/personaje-contratacion.svg'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'

/**
 * Se abre justo después de confirmar el paso a Amarillo (`ChangeStatusDialog`):
 * es el mismo momento en que el Contrato se vuelve posible (`CONTRACT_STATUSES`
 * en `ProspectDetailPage` incluye YELLOW), así que en vez de dejar al BD/BDC
 * buscar la tarjeta "Sigue el contrato" por su cuenta, se le avisa aquí mismo.
 *
 * A diferencia de `CreateProposalPromptDialog`, "Ir al contrato" no crea nada
 * todavía: solo lleva a la ficha del hotel, donde el contrato se arma con las
 * tarifas que ya se cotizaron — la misma tarjeta que este modal anuncia.
 */
export function ContractUnlockedDialog({
  isOpen,
  onClose,
  prospectId,
  hotelName,
}: {
  isOpen: boolean
  onClose: () => void
  prospectId: string
  hotelName: string
}): ReactNode {
  const { t } = useLingui()
  const navigate = useNavigate()

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t`Ya puedes armar el contrato`}
      description={t`${hotelName} pasó a Amarillo: el contrato nace con las tarifas que ya se cotizaron en la propuesta — las revisas, ajustas lo que se haya negociado y lo guardas en Borrador.`}
      footer={
        <>
          <Button onClick={onClose}>{t`Más tarde`}</Button>
          <Button
            variant="primary"
            onClick={() => {
              onClose()
              void navigate(`/pipeline/${prospectId}`)
            }}
          >
            {t`Ir al contrato`}
          </Button>
        </>
      }
    >
      <img src={personajeContratacion} alt="" aria-hidden className="mx-auto h-28 w-auto" />
    </Modal>
  )
}
