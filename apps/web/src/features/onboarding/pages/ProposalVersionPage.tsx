import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import { useGetProposalWorkspaceQuery } from '../api/proposalsApi'
import { ContractPreviewButton } from '../components/ContractPreviewButton'
import { ProposalVersionHistory } from '../components/ProposalVersionHistory'

import { buttonClass } from '@/shared/components/Button'
import { SectionCard } from '@/shared/components/SectionCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { formatDate, formatMoney } from '@/shared/lib/formatters'

/**
 * Una versión concreta de la propuesta, en SOLO LECTURA, dentro del módulo
 * Propuestas.
 *
 * Es a donde lleva «Ver propuesta» desde la ficha del hotel. No edita nada: una
 * versión enviada no se toca, y el borrador se corrige en el editor del
 * pipeline, que es el único sitio donde se escribe.
 *
 * ⚠ Esta pantalla NO tiene maqueta; se armó con las formas que ya existen.
 */
export function ProposalVersionPage(): ReactNode {
  const { prospectId = '', version = '' } = useParams()
  const versionNumber = Number(version)

  const {
    data: workspace,
    isLoading,
    isError,
  } = useGetProposalWorkspaceQuery(prospectId, { skip: prospectId === '' })

  if (isLoading) return <p className="text-sm text-ink-3">Cargando la propuesta…</p>

  const selected = workspace?.versions.find((item) => item.version === versionNumber)

  if (isError || !workspace || !selected) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-6">
        <p className="text-sm text-red">No se encontró esa versión de la propuesta.</p>
        <Link to="/propuestas" className="text-sm font-semibold text-o-700 hover:underline">
          Volver a Propuestas
        </Link>
      </div>
    )
  }

  const margin = selected.billRate - selected.payRate
  const marginPercent = selected.billRate > 0 ? (margin / selected.billRate) * 100 : 0

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Ruta" className="flex items-center gap-2 text-sm text-ink-3">
        <Link to="/propuestas" className="hover:text-o-700">
          Propuestas
        </Link>
        <span aria-hidden>›</span>
        <Link to={`/pipeline/${prospectId}`} className="hover:text-o-700">
          {workspace.hotelName}
        </Link>
        <span aria-hidden>›</span>
        <span className="text-ink-2">Propuesta v{selected.version}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              Propuesta v{selected.version} · {workspace.hotelName}
            </h1>
            <StatusLightSoftBadge
              token={ONBOARDING_STATUS_TOKEN[workspace.prospectStatus]}
              label={ONBOARDING_STATUS_LABEL[workspace.prospectStatus]}
            />
          </div>
          <p className="mt-1.5 text-sm text-ink-3">
            {selected.sentAt
              ? `Enviada ${formatDate(selected.sentAt)} · ${selected.byName}`
              : 'Borrador sin enviar · sent_at es NULL hasta enviarla'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ContractPreviewButton hotelName={workspace.hotelName} version={selected} />
          <Link to={`/pipeline/${prospectId}/propuesta`} className={buttonClass('secondary')}>
            Abrir en el editor
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <SectionCard title="Servicios ofrecidos">
            <p className="text-sm leading-relaxed text-ink-2">{selected.servicesNote}</p>
          </SectionCard>

          <SectionCard title="Tarifas">
            <dl className="flex flex-col gap-3.5">
              <div className="flex items-baseline justify-between gap-6">
                <dt className="text-sm text-ink-3">Pay rate por hora</dt>
                <dd className="text-sm text-ink">{formatMoney(selected.payRate)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-6">
                <dt className="text-sm text-ink-3">Bill rate por hora</dt>
                <dd className="text-sm text-ink">{formatMoney(selected.billRate)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-6 border-t border-line pt-3.5">
                <dt className="text-sm font-semibold text-ink">Margen bruto por hora</dt>
                <dd className="text-sm font-semibold text-ink">
                  {formatMoney(margin)} · {marginPercent.toFixed(1)}%
                </dd>
              </div>
            </dl>
          </SectionCard>
        </div>

        <ProposalVersionHistory hotelName={workspace.hotelName} versions={workspace.versions} />
      </div>
    </div>
  )
}
