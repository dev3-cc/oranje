import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { ProposalVersionSummary } from '../types/proposal.types'

import { ContractPreviewButton } from './ContractPreviewButton'

import { SectionCard } from '@/shared/components/SectionCard'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDate, formatMoney } from '@/shared/lib/formatters'

/** Sin fecha de envío: el borrador todavía no tiene `sent_at`. */
const NOT_SENT = '—'

export function ProposalVersionHistory({
  hotelName,
  versions,
}: {
  hotelName: string
  versions: ProposalVersionSummary[]
}): ReactNode {
  return (
    <SectionCard title="Historial de versiones">
      {versions.length === 0 ? (
        <p className="py-2 text-sm text-ink-3">Todavía no hay versiones de la propuesta.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {versions.map((version) => (
            <li
              key={version.id}
              className={cn(
                'rounded-md p-4',
                version.status === 'DRAFT' ? 'bg-o-50' : 'border border-line bg-surface-2',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">Propuesta v{version.version}</p>
                  <p className="mt-1 text-sm text-ink-3">
                    {version.sentAt ? formatDate(version.sentAt) : NOT_SENT} ·{' '}
                    {`pay ${formatMoney(version.payRate)}`} ·{' '}
                    {`bill ${formatMoney(version.billRate)}`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-xs font-semibold text-ink-2">
                    {version.status === 'DRAFT' ? 'Borrador' : 'Enviada'}
                  </span>
                  <ContractPreviewButton hotelName={hotelName} version={version} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-ink-3">
        {IS_DEV_UI
          ? 'ux_proposal_prospect_version — una fila por versión; no se borran al cerrar'
          : 'Cada envío queda como una versión; ninguna se borra.'}
      </p>
    </SectionCard>
  )
}
