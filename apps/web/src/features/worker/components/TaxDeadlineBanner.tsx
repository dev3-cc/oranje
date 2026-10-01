import { Trans, useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { TaxDeadlineApi } from '../types/worker.types'

import personajePagoProcesado from '@/assets/ilustrations/personaje-pago-procesado.svg'
import personajeUrgente from '@/assets/ilustrations/personaje-urgente.svg'
import { NoticeCard } from '@/shared/components/NoticeCard'

const ACTION_LINK =
  'inline-flex min-h-11 touch-manipulation items-center rounded-md bg-o-300 shadow-xs px-4 text-sm font-semibold text-ink transition-colors hover:bg-o-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-700'

/**
 * Confirma que el SSN/ITIN quedó cargado (y si ya lo revisó Reclutamiento), o
 * — si Reclutamiento lo rechazó — dice por qué y que hay que volver a
 * subirlo (Hugo, 2026-09-30: sin esto solo se veía "carga tu SSN o ITIN" otra
 * vez, sin explicar que ya lo había hecho). El plazo se unificó con el del
 * expediente a medias: «Faltan datos tuyos» en Inicio avisa antes de
 * validarlo, y «Completa tus datos» (`AccessDeadlineBanner`) avisa con fecha
 * después — este banner no repite esa cuenta regresiva, solo confirma el
 * estado del documento.
 */
export function TaxDeadlineBanner({ deadline }: { deadline: TaxDeadlineApi }): ReactNode {
  const { t } = useLingui()

  if (deadline.hasDocument) {
    return (
      <NoticeCard image={personajePagoProcesado} title={t`SSN/ITIN recibido`} role="status">
        <Trans>
          Tu SSN/ITIN está{' '}
          {deadline.isDocumentVerified ? t`verificado` : t`cargado, en verificación`}.
        </Trans>
      </NoticeCard>
    )
  }

  if (deadline.wasRejected) {
    return (
      <NoticeCard
        image={personajeUrgente}
        title={t`Tu SSN/ITIN fue rechazado`}
        tone="warning"
        role="alert"
        action={
          <Link to="/collaborator/signup-2" className={ACTION_LINK}>
            <Trans>Subir de nuevo</Trans>
          </Link>
        }
      >
        {deadline.rejectionReason ?? t`No pasó la revisión.`}
      </NoticeCard>
    )
  }

  return null
}
