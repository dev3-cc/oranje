import { Trans, useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'

import type { TaxDeadlineApi } from '../types/worker.types'

import personajePagoProcesado from '@/assets/ilustrations/personaje-pago-procesado.svg'
import { NoticeCard } from '@/shared/components/NoticeCard'

/**
 * Confirma que el SSN/ITIN quedó cargado (y si ya lo revisó Reclutamiento).
 * El plazo para cargarlo se unificó con el del expediente a medias
 * (2026-09-30): «Faltan datos tuyos» en Inicio avisa antes de validarlo, y
 * «Completa tus datos» (`AccessDeadlineBanner`) avisa con fecha después —
 * este banner ya no repite esa cuenta regresiva, solo confirma el estado.
 */
export function TaxDeadlineBanner({ deadline }: { deadline: TaxDeadlineApi }): ReactNode {
  const { t } = useLingui()

  if (!deadline.hasDocument) {
    return null
  }

  return (
    <NoticeCard image={personajePagoProcesado} title={t`SSN/ITIN recibido`} role="status">
      <Trans>
        Tu SSN/ITIN está {deadline.isDocumentVerified ? t`verificado` : t`cargado, en verificación`}
        .
      </Trans>
    </NoticeCard>
  )
}
