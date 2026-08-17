import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import { useGetContractQuery } from '../api/contractsApi'
import { EngineRulesCard } from '../components/EngineRulesCard'
import { MultiplierTable } from '../components/MultiplierTable'
import { RateTable } from '../components/RateTable'

import { Button } from '@/shared/components/Button'
import { SectionCard } from '@/shared/components/SectionCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_TOKEN,
  WEEK_DAY_NAMES,
} from '@/shared/constants/contractStatus'
import { formatDate } from '@/shared/lib/formatters'

/** Vigencia sin fin: no es una fecha ausente, es una decisión. */
const OPEN_ENDED = 'Indefinido'

export function ContractDetailPage(): ReactNode {
  const { contractId = '' } = useParams()

  const {
    data: contract,
    isLoading,
    isError,
  } = useGetContractQuery(contractId, { skip: contractId === '' })

  if (isLoading) {
    return <p className="text-sm text-ink-3">Cargando contrato…</p>
  }

  if (isError || !contract) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-6">
        <p className="text-sm text-red">No se encontró el contrato.</p>
        <Link to="/documentos-tc" className="text-sm font-semibold text-o-700 hover:underline">
          Volver a Documentos T&amp;C
        </Link>
      </div>
    )
  }

  const validityFields = [
    { label: 'Desde', value: formatDate(contract.validFrom), foot: 'valid_from' },
    {
      label: 'Hasta',
      value: contract.validTo === null ? OPEN_ENDED : formatDate(contract.validTo),
      foot: 'valid_to · nulo = indefinido',
    },
    {
      label: 'Semana',
      value: `${WEEK_DAY_NAMES[contract.weekStartDay] ?? '—'} → ${WEEK_DAY_NAMES[contract.weekEndDay] ?? '—'}`,
      foot: `week_start_day ${String(contract.weekStartDay)} · week_end_day ${String(contract.weekEndDay)}`,
    },
    { label: 'Número', value: contract.number, foot: 'number · único' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Ruta" className="flex items-center gap-2 text-sm text-ink-3">
        <Link to="/documentos-tc" className="hover:text-o-700">
          Documentos T&amp;C
        </Link>
        <span aria-hidden>/</span>
        <span className="font-semibold text-ink-2">{contract.number}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              Contrato {contract.number}
            </h1>
            <StatusLightSoftBadge
              token={CONTRACT_STATUS_TOKEN[contract.status]}
              label={CONTRACT_STATUS_LABEL[contract.status]}
            />
          </div>
          <p className="mt-1.5 text-sm text-ink-3">
            commercial.contract · {contract.hotelName} · firmado por {contract.signedByName} el{' '}
            {formatDate(contract.signedAt)}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          {/* Las dos esperan maqueta; se dejan visibles para no mover el encabezado después. */}
          <Button variant="secondary" disabled title="Pendiente: falta el diseño del PDF">
            Ver PDF
          </Button>
          <Button variant="primary" disabled title="Pendiente: falta el diseño de la edición">
            Editar contrato
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <SectionCard
            title="Vigencia y semana de nómina"
            subtitle="valid_from · valid_to · week_start_day · week_end_day"
          >
            <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {validityFields.map((field) => (
                <div key={field.label} className="min-w-0">
                  <dt className="text-sm text-ink-3">{field.label}</dt>
                  <dd className="mt-1 text-lg font-bold text-ink">{field.value}</dd>
                  <p className="mt-1 text-xs text-ink-3">{field.foot}</p>
                </div>
              ))}
            </dl>
          </SectionCard>

          <MultiplierTable
            overtime={contract.multipliers.overtime}
            holiday={contract.multipliers.holiday}
          />

          <RateTable rates={contract.rates} />
        </div>

        <div className="flex flex-col gap-6">
          <EngineRulesCard />

          <section className="rounded-lg bg-yellow/15 p-6">
            <h2 className="text-base font-semibold text-ink">
              El contrato es la fuente del dinero
            </h2>
            <p className="mt-3 text-sm text-ink-2">
              settlement toma de aquí las tarifas y los multiplicadores para calcular pago y
              factura. Un cambio de contrato no debe recalcular semanas ya aprobadas: por eso la
              vigencia tiene fecha, y el consolidado guarda lo que regía ese día.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
