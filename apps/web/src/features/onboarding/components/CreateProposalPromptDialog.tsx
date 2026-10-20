import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { useCreateProposalDraftMutation } from '../api/proposalsApi'

import personajePresentacion from '@/assets/ilustrations/personaje-presentacion.svg'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { apiErrorMessage } from '@/shared/lib/apiError'

/**
 * Se abre justo después de confirmar el paso a Verde (`ChangeStatusDialog`):
 * es el mismo momento en que el prospecto ya puede tener propuesta
 * (`WORKING_STATES` en `proposals.service.ts` incluye GREEN), así que en vez
 * de dejar al BD/BDC buscar el botón aparte, se le pregunta aquí mismo.
 *
 * "Sí" repite exactamente lo que hace `NewProposalDialog.start()`: crea el
 * borrador v1 y navega a cotizarlo. "No" no hace nada — el prospecto se
 * queda en Verde, sin propuesta, y se abre después desde su ficha.
 */
export function CreateProposalPromptDialog({
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
  const { t, i18n } = useLingui()
  const navigate = useNavigate()
  const [createDraft, { isLoading: isCreating, isError, error }] = useCreateProposalDraftMutation()
  const [hasStarted, setHasStarted] = useState(false)

  async function startNow(): Promise<void> {
    setHasStarted(true)
    try {
      await createDraft(prospectId).unwrap()
      toast.success(t`Borrador v1 abierto`)
      onClose()
      void navigate(`/pipeline/${prospectId}/proposal`)
    } catch {
      setHasStarted(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t`¿Creamos la propuesta ahora?`}
      description={t`${hotelName} ya está en Verde: puedes armar y enviar su propuesta aquí mismo, o hacerlo después desde su ficha.`}
      footer={
        <>
          <Button onClick={onClose} disabled={isCreating}>
            {t`Más tarde`}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              void startNow()
            }}
            disabled={isCreating}
          >
            {isCreating && hasStarted ? t`Abriendo…` : t`Sí, crear propuesta`}
          </Button>
        </>
      }
    >
      <img src={personajePresentacion} alt="" aria-hidden className="mx-auto h-28 w-auto" />

      {isError && (
        <p role="alert" className="text-sm text-red">
          {apiErrorMessage(error, {
            byStatus: {
              403: i18n._(
                msg`Las propuestas las elabora el BD dueño de cada prospecto: pídele que la abra.`,
              ),
            },
            fallback: t`No se pudo abrir el borrador. Ciérralo e inténtalo de nuevo desde la ficha del prospecto.`,
          })}
        </p>
      )}
    </Modal>
  )
}
