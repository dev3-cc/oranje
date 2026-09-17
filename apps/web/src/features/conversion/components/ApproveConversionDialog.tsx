import { Trans, useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'

import type { ConversionReadiness } from '../types/conversion.types'

import { Button } from '@/shared/components/Button'
import { HotelPhotoBackdrop } from '@/shared/components/HotelPhotoBackdrop'
import { Modal } from '@/shared/components/Modal'

/**
 * Convertir es el acto que vuelve cliente a un hotel: desde ahí puede pedir
 * personal, su gente cobra y se le factura. Era un botón que lo hacía al
 * primer clic, sin decir qué cambiaba.
 *
 * El diálogo pone al hotel con su foto —de eso se trata, de un hotel concreto,
 * no de una fila— y enumera lo que va a pasar, con las consecuencias que nadie
 * adivina: el ciclo comercial se cierra y de Naranja ya no se regresa.
 */
export function ApproveConversionDialog({
  isOpen,
  onClose,
  onConfirm,
  isApproving,
  readiness,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isApproving: boolean
  readiness: ConversionReadiness
}): ReactNode {
  const { t } = useLingui()

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t`Convertir en cliente`}
      description={readiness.hotelName}
      className="max-w-lg"
      footer={
        <>
          <Button onClick={onClose} disabled={isApproving}>
            <Trans>Todavía no</Trans>
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={isApproving}>
            {isApproving ? t`Convirtiendo…` : t`Sí, convertir en cliente`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* El hotel con su foto: convertir no es mover una fila de una lista. */}
        <div className="relative h-36 overflow-hidden rounded-xl">
          <HotelPhotoBackdrop photoUrl={readiness.hotelPhotoUrl} />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-ink/5"
          />
          <div className="absolute inset-x-3 bottom-3 text-white">
            <p className="truncate text-lg font-bold" title={readiness.hotelName}>
              {readiness.hotelName}
            </p>
            <p className="text-sm text-white/85">
              <Trans>Rosa → Naranja</Trans>
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-ink">
            <Trans>Al convertirlo</Trans>
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink-2">
            {readiness.effects.map((effect) => (
              <li key={effect}>{effect}</li>
            ))}
          </ul>
        </div>

        <p className="rounded-md bg-o-50 p-4 text-sm leading-relaxed text-ink-2">
          <Trans>
            El ciclo comercial se cierra aquí: de Naranja no se regresa. Si más adelante el hotel se
            pausa, se le marca como inactivo, pero el ciclo no vuelve a abrirse.
          </Trans>
        </p>
      </div>
    </Modal>
  )
}
