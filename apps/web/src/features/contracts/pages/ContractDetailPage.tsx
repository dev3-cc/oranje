import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import { useGetContractQuery, useTransitionContractMutation } from '../api/contractsApi'
import { EditRateDialog } from '../components/EditRateDialog'
import { EngineRulesCard } from '../components/EngineRulesCard'
import { MultiplierTable } from '../components/MultiplierTable'
import { RateTable } from '../components/RateTable'

import { Button } from '@/shared/components/Button'
import { LoadingState } from '@/shared/components/LoadingState'
import { SectionCard } from '@/shared/components/SectionCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_TOKEN,
  WEEK_DAY_NAMES,
} from '@/shared/constants/contractStatus'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDate } from '@/shared/lib/formatters'

const OPEN_ENDED = 'Indefinido'

export function ContractDetailPage(): ReactNode {
  const { contractId = '' } = useParams()

  const {
    data: contract,
    isLoading,
    isError,
  } = useGetContractQuery(contractId, { skip: contractId === '' })

  const [isEditingRate, setIsEditingRate] = useState(false)
  /** Los cierres piden un segundo clic: el botón se vuelve «¿Confirmar…?». */
  const [confirming, setConfirming] = useState<'activate' | 'expire' | 'cancel' | null>(null)
  const [transition, { isLoading: isTransitioning, isError: hasTransitionFailed, error }] =
    useTransitionContractMutation()

  async function run(action: 'activate' | 'expire' | 'cancel'): Promise<void> {
    if (confirming !== action) {
      setConfirming(action)
      return
    }
    setConfirming(null)
    try {
      await transition({ contractId, action }).unwrap()
    } catch {
      return
    }
  }

  if (isLoading) {
    return <LoadingState label="Cargando el contrato…" />
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
            {IS_DEV_UI && 'commercial.contract · '}
            {contract.hotelName} ·{' '}
            {contract.signedByName === '—'
              ? 'firmado el'
              : `firmado por ${contract.signedByName} el`}{' '}
            {formatDate(contract.signedAt)}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          {}
          <Button variant="secondary" disabled title="Pendiente: falta el diseño del PDF">
            Ver PDF
          </Button>

          {/* Las acciones dependen del estado: DRAFT se edita y activa; ACTIVE solo se expira. */}
          {contract.status === 'DRAFT' && (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsEditingRate(true)
                }}
              >
                Editar tarifas
              </Button>
              <Button
                variant="secondary"
                disabled={isTransitioning}
                onClick={() => {
                  void run('cancel')
                }}
              >
                {confirming === 'cancel' ? '¿Confirmar cancelación?' : 'Cancelar borrador'}
              </Button>
              <Button
                variant="primary"
                disabled={isTransitioning}
                onClick={() => {
                  void run('activate')
                }}
              >
                {confirming === 'activate' ? '¿Confirmar activación?' : 'Activar contrato'}
              </Button>
            </>
          )}
          {contract.status === 'ACTIVE' && (
            <Button
              variant="secondary"
              disabled={isTransitioning}
              onClick={() => {
                void run('expire')
              }}
            >
              {confirming === 'expire' ? '¿Confirmar expiración?' : 'Marcar expirado'}
            </Button>
          )}
        </div>
      </header>

      {hasTransitionFailed && (
        <p role="alert" className="text-sm text-red">
          {apiErrorMessage(error, {
            byCode: {
              CONTRACT_WITHOUT_RATES: 'No se puede activar sin tarifas: agrega al menos una.',
              CONTRACT_ALREADY_ACTIVE:
                'Este hotel ya tiene un contrato vigente: primero hay que expirarlo.',
              CONTRACT_NOT_DRAFT: 'Este contrato ya dejó de ser borrador.',
              CONTRACT_NOT_ACTIVE: 'Solo un contrato vigente se puede expirar.',
              CONTRACT_ALREADY_CLOSED: 'Este contrato ya está cerrado.',
            },
            fallback: 'No se pudo cambiar el estado del contrato. Inténtalo de nuevo.',
          })}
        </p>
      )}

      <EditRateDialog
        contractId={contractId}
        isOpen={isEditingRate}
        onClose={() => {
          setIsEditingRate(false)
        }}
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <SectionCard
            title="Vigencia y semana de nómina"
            subtitle={
              IS_DEV_UI
                ? 'valid_from · valid_to · week_start_day · week_end_day'
                : 'La semana de nómina la fija el contrato'
            }
          >
            <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {validityFields.map((field) => (
                <div key={field.label} className="min-w-0">
                  <dt className="text-sm text-ink-3">{field.label}</dt>
                  <dd className="mt-1 text-lg font-bold text-ink">{field.value}</dd>
                  {IS_DEV_UI && <p className="mt-1 text-xs text-ink-3">{field.foot}</p>}
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
          {}
          {IS_DEV_UI && <EngineRulesCard />}

          <section className="rounded-lg bg-yellow/15 p-6">
            <h2 className="text-base font-semibold text-ink">
              El contrato es la fuente del dinero
            </h2>
            <p className="mt-3 text-sm text-ink-2">
              {IS_DEV_UI
                ? 'settlement toma de aquí las tarifas y los multiplicadores para calcular pago y factura. Un cambio de contrato no debe recalcular semanas ya aprobadas: por eso la vigencia tiene fecha, y el consolidado guarda lo que regía ese día.'
                : 'La nómina y la factura toman de aquí las tarifas y los multiplicadores. Un cambio de contrato no recalcula semanas ya aprobadas: la vigencia tiene fecha, y el consolidado guarda lo que regía ese día.'}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
