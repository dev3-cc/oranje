import { useLingui } from '@lingui/react/macro'
import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

import personajeTratoCerrado from '@/assets/ilustrations/personaje-trato-cerrado.svg'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { MOTION } from '@/shared/lib/motion'

/**
 * Paso previo a CUALQUIER camino que deja la propuesta en Enviada —por
 * correo o marcada a mano— porque los dos comparten la misma consecuencia
 * irreversible: `ProposalsService` la congela (`PROPOSAL_ALREADY_SENT`) y de
 * ahí en adelante solo se abre una versión nueva, nunca se vuelve a editar
 * esta. Hugo pidió explícito un modal con ilustración animada en vez del
 * patrón de doble-toque + toast que ya usa «Descartar borrador»: esa acción
 * se puede deshacer empezando de nuevo, esta no.
 */
export function ConfirmSendProposalDialog({
  isOpen,
  onClose,
  onConfirm,
  isConfirming,
  mode,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isConfirming: boolean
  /** `email`: se arma el PDF y se abre el correo. `mark`: se congela sin mandar nada (se entregó impresa o por otro medio). */
  mode: 'email' | 'mark'
}): ReactNode {
  const { t } = useLingui()
  const reduceMotion = useReducedMotion() ?? false

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === 'email' ? t`¿Enviamos la propuesta?` : t`¿Marcamos la propuesta como enviada?`
      }
      description={
        mode === 'email'
          ? t`Se arma el PDF y se manda por correo al contacto del hotel.`
          : t`Úsalo cuando ya se entregó por otro medio — impresa, en mano, por otro correo.`
      }
      footer={
        <>
          <Button onClick={onClose} disabled={isConfirming}>
            {t`Cancelar`}
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={isConfirming}>
            {isConfirming
              ? t`Enviando…`
              : mode === 'email'
                ? t`Sí, enviar propuesta`
                : t`Sí, marcar como enviada`}
          </Button>
        </>
      }
    >
      <motion.img
        src={personajeTratoCerrado}
        alt=""
        aria-hidden
        className="mx-auto h-28 w-auto"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.85, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : MOTION.enter, ease: [...MOTION.easeOut] }}
      />

      <p className="mt-2 rounded-md bg-o-50 p-4 text-sm leading-relaxed text-ink-2">
        {t`Después de esto la versión queda congelada: no se vuelve a editar. Para cualquier cambio, aunque sea pequeño, se abre una versión nueva.`}
      </p>
    </Modal>
  )
}
