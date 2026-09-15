import { Trans, useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { summarizeRates } from '../lib/summarizeRates'
import type { ProposalVersionSummary } from '../types/proposal.types'

import { ContractPreviewButton } from './ContractPreviewButton'

import { buttonClass } from '@/shared/components/Button'
import { SectionCard } from '@/shared/components/SectionCard'
import { formatDate } from '@/shared/lib/formatters'

/**
 * Versiones de la propuesta dentro de la ficha del prospecto, de la más
 * reciente a la más vieja. Se muestran TODAS y no solo la vigente: la
 * negociación es el historial de tarifas.
 *
 * Cada fila tiene dos salidas distintas y a propósito:
 *   - «Ver propuesta» abre ESA versión en el módulo Propuestas, en solo lectura.
 *   - «Abrir propuesta», al pie, entra al editor del hotel, donde se crea la
 *     siguiente versión o se corrige el borrador abierto.
 */
export function ProposalVersionList({
  prospectId,
  hotelName,
  versions,
  isLoading = false,
}: {
  prospectId: string
  hotelName: string
  versions: ProposalVersionSummary[]
  isLoading?: boolean
}): ReactNode {
  const { t, i18n } = useLingui()
  return (
    <SectionCard title={t`Versiones de la propuesta`}>
      {isLoading && (
        <p className="py-2 text-sm text-ink-3">
          <Trans>Cargando propuestas…</Trans>
        </p>
      )}

      {!isLoading && versions.length === 0 && (
        <p className="py-2 text-sm text-ink-3">
          <Trans>Todavía no hay propuesta para este hotel. Empieza con «Abrir propuesta».</Trans>
        </p>
      )}

      {versions.length > 0 && (
        <ul className="flex flex-col gap-4">
          {versions.map((version) => (
            <li
              key={version.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  <Trans>Propuesta v{version.version}</Trans>
                </p>
                <p className="mt-1 text-sm text-ink-3">
                  {version.sentAt
                    ? t`Enviada ${formatDate(version.sentAt)} · ${version.byName}`
                    : t`Borrador · sin enviar`}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <p className="text-sm text-ink-2">{summarizeRates(version, i18n)}</p>

                <ContractPreviewButton hotelName={hotelName} version={version} />

                <Link
                  to={`/proposals/${prospectId}/${String(version.version)}`}
                  className={buttonClass('yellow', 'px-3 py-1.5 text-xs')}
                >
                  <Trans>Ver propuesta</Trans>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link
        to={`/pipeline/${prospectId}/proposal`}
        className={buttonClass('secondary', 'mt-6 w-full')}
      >
        <Trans>Abrir propuesta</Trans>
      </Link>
    </SectionCard>
  )
}
