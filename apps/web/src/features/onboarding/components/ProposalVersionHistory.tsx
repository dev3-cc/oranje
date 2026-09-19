import { Trans, useLingui } from '@lingui/react/macro'
import {
  MaterialIcon,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from '@oranje/ui'
import type { ReactNode } from 'react'

import { summarizeRates } from '../lib/summarizeRates'
import type { ProposalVersionSummary } from '../types/proposal.types'

import { ContractPreviewButton } from './ContractPreviewButton'

import { SectionCard } from '@/shared/components/SectionCard'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDate } from '@/shared/lib/formatters'

/** Sin fecha de envío: el borrador todavía no tiene `sent_at`. */
const NOT_SENT = '—'

export function ProposalVersionHistory({
  hotelName,
  hotelAddress = null,
  contactEmail = null,
  senderName = 'Oranje',
  versions,
}: {
  hotelName: string
  hotelAddress?: string | null
  contactEmail?: string | null
  senderName?: string
  versions: ProposalVersionSummary[]
}): ReactNode {
  const { t, i18n } = useLingui()
  /** La enviada más reciente es la copia que el hotel tiene en la mano. */
  const hotelsCopyId =
    [...versions]
      .filter((version) => version.sentAt !== null)
      .sort((a, b) => b.version - a.version)[0]?.id ?? null
  return (
    <SectionCard title={t`Historial de versiones`}>
      {versions.length === 0 ? (
        <p className="py-2 text-sm text-ink-3">
          <Trans>Todavía no hay versiones de la propuesta.</Trans>
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {versions.map((version) => {
            /* La que TIENE el hotel: la enviada más reciente. El icono la señala. */
            const isHotelsCopy = version.id === hotelsCopyId
            return (
              <li
                key={version.id}
                className={cn(
                  'rounded-md p-4',
                  version.status === 'DRAFT' ? 'bg-o-50' : 'border border-line bg-surface-2',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                      <Trans>Propuesta v{version.version}</Trans>
                      {isHotelsCopy && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              aria-label={t`Esta es la versión que tiene el hotel`}
                              className="flex size-5 cursor-default items-center justify-center rounded-full bg-st-naranja/15 text-st-naranja"
                            >
                              <MaterialIcon name="mark_email_read" className="text-[14px]" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <Trans>
                                Esta es la versión que tiene el hotel: la última que se le envió.
                              </Trans>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-ink-3">
                      {version.sentAt
                        ? version.byName
                          ? t`Enviada ${formatDate(version.sentAt)} por ${version.byName}`
                          : t`Enviada ${formatDate(version.sentAt)}`
                        : NOT_SENT}{' '}
                      · {summarizeRates(version, i18n)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <span className="text-xs font-semibold text-ink-2">
                      {version.status === 'DRAFT' ? t`Borrador` : t`Enviada`}
                    </span>
                    <ContractPreviewButton
                      hotelName={hotelName}
                      hotelAddress={hotelAddress}
                      contactEmail={contactEmail}
                      senderName={senderName}
                      version={version}
                    />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-ink-3">
        {IS_DEV_UI ? (
          'ux_proposal_prospect_version — una fila por versión; no se borran al cerrar'
        ) : (
          <Trans>Cada envío queda como una versión; ninguna se borra.</Trans>
        )}
      </p>
    </SectionCard>
  )
}
