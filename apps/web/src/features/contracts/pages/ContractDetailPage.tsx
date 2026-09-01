import { toast } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import { useGetContractQuery, useTransitionContractMutation } from '../api/contractsApi'
import { buildContractChecks } from '../components/ContractChecklist'
import { ContractNextStep } from '../components/ContractNextStep'
import { ContractPaper } from '../components/ContractPaper'
import { EditRateDialog } from '../components/EditRateDialog'
import { MultiplierTable } from '../components/MultiplierTable'
import { RateTable } from '../components/RateTable'

import personajeContratacion from '@/assets/ilustrations/personaje-contratacion.svg'
import { Button } from '@/shared/components/Button'
import { DetailSkeleton } from '@/shared/components/DetailSkeleton'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { SectionCard } from '@/shared/components/SectionCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_TOKEN,
  WEEK_DAY_NAMES,
} from '@/shared/constants/contractStatus'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDate } from '@/shared/lib/formatters'

const OPEN_ENDED = 'Indefinido'

export function ContractDetailPage({
  contractId: contractIdProp,
  embedded = false,
  activeContractNumber = null,
}: {
  /** Embebida en la lista (patrón lista-detalle): el id llega por prop, no por la ruta. */
  contractId?: string
  embedded?: boolean
  /** El contrato vigente del mismo hotel (lo sabe la lista); «Qué sigue» lo advierte. */
  activeContractNumber?: string | null
} = {}): ReactNode {
  const params = useParams()
  const contractId = contractIdProp ?? params.contractId ?? ''

  /*
   * `currentData`, no `data`: al cambiar de contrato en la lista, `data` se
   * queda con el anterior mientras llega el nuevo y la pantalla mentiría un
   * instante. Con `currentData` se vacía y aparece el skeleton.
   */
  const {
    currentData: contract,
    isFetching,
    isError,
  } = useGetContractQuery(contractId, { skip: contractId === '' })

  const can = useCan()
  /** Activar, expirar y cancelar piden terms_and_conditions:approve — son del BDC. */
  const canApprove = can('terms_and_conditions:approve')
  const canEditRates = can('terms_and_conditions:update')

  const [isEditingRate, setIsEditingRate] = useState(false)
  /** Los cierres piden un segundo clic: el botón se vuelve «¿Confirmar…?». */
  const [confirming, setConfirming] = useState<'activate' | 'expire' | 'cancel' | null>(null)
  const [transition, { isLoading: isTransitioning, isError: hasTransitionFailed, error }] =
    useTransitionContractMutation()

  /** Cambiar de contrato desarma cualquier confirmación a medias. */
  useEffect(() => {
    setConfirming(null)
    setIsEditingRate(false)
  }, [contractId])

  const [pendingAction, setPendingAction] = useState<'activate' | 'expire' | 'cancel' | null>(null)

  async function run(action: 'activate' | 'expire' | 'cancel'): Promise<void> {
    if (confirming !== action) {
      setConfirming(action)
      return
    }
    setConfirming(null)
    setPendingAction(action)
    try {
      await transition({ contractId, action }).unwrap()
      toast.success(
        action === 'activate'
          ? `Contrato ${contract?.number ?? ''} activado`
          : action === 'cancel'
            ? 'Borrador cancelado'
            : 'Contrato marcado como expirado',
      )
    } catch {
      return
    } finally {
      setPendingAction(null)
    }
  }

  if (isFetching && !contract) {
    return <DetailSkeleton />
  }

  if (isError || !contract) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-6">
        <p className="text-sm text-red">
          Este contrato no existe o fue borrado. Vuelve a la lista y elige otro.
        </p>
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

  /* El botón de activar respeta la lista: si hay un problema, el motor lo rechazaría igual. */
  const hasFailingChecks = buildContractChecks(contract).some((check) => check.status === 'fail')

  return (
    <div className="flex flex-col gap-6">
      {!embedded && (
        <nav aria-label="Ruta" className="flex items-center gap-2 text-sm text-ink-3">
          <Link to="/documentos-tc" className="hover:text-o-700">
            Documentos T&amp;C
          </Link>
          <span aria-hidden>/</span>
          <span className="font-semibold text-ink-2">{contract.number}</span>
        </nav>
      )}

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
          <Button variant="secondary" disabled title="El PDF del contrato aún no está disponible">
            Ver PDF
          </Button>

          {/* Las acciones dependen del estado: DRAFT se edita y activa; ACTIVE solo se expira. */}
          {contract.status === 'DRAFT' && (
            <>
              {canEditRates && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsEditingRate(true)
                  }}
                >
                  Editar tarifas
                </Button>
              )}
              {canApprove && (
                <>
                  <Button
                    variant="secondary"
                    disabled={isTransitioning}
                    onClick={() => {
                      void run('cancel')
                    }}
                  >
                    {pendingAction === 'cancel'
                      ? 'Cancelando…'
                      : confirming === 'cancel'
                        ? 'Sí, cancelar borrador'
                        : 'Cancelar borrador'}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={isTransitioning || hasFailingChecks}
                    title={
                      hasFailingChecks
                        ? 'Antes hay que resolver lo que dice «Qué sigue»'
                        : undefined
                    }
                    onClick={() => {
                      void run('activate')
                    }}
                  >
                    {pendingAction === 'activate'
                      ? 'Activando…'
                      : confirming === 'activate'
                        ? 'Sí, activar contrato'
                        : 'Activar contrato'}
                  </Button>
                </>
              )}
            </>
          )}
          {contract.status === 'ACTIVE' && canApprove && (
            <Button
              variant="secondary"
              disabled={isTransitioning}
              onClick={() => {
                void run('expire')
              }}
            >
              {pendingAction === 'expire'
                ? 'Marcando…'
                : confirming === 'expire'
                  ? 'Sí, marcar expirado'
                  : 'Marcar expirado'}
            </Button>
          )}
        </div>
      </header>

      {/* Sin approve, la acción que da sentido al borrador se explica: quién sigue. */}
      {contract.status === 'DRAFT' && !canApprove && (
        <NoticeCard image={personajeContratacion} title="Activar es del BDC" role="status">
          Este borrador lo activa el BDC cuando la verificación de «Qué sigue» esté en verde: al
          activarlo, el contrato pasa a regir la nómina y la factura del hotel.
        </NoticeCard>
      )}

      {hasTransitionFailed && (
        <p role="alert" className="text-sm text-red">
          {apiErrorMessage(error, {
            byCode: {
              CONTRACT_WITHOUT_RATES: 'No se puede activar sin tarifas: agrega al menos una.',
              CONTRACT_ALREADY_ACTIVE:
                'Este hotel ya tiene un contrato vigente: primero hay que expirarlo.',
              CONTRACT_NOT_DRAFT:
                'Este contrato ya no es borrador: no se puede editar ni cancelar.',
              CONTRACT_NOT_ACTIVE: 'Solo un contrato vigente se puede marcar expirado.',
              CONTRACT_ALREADY_CLOSED: 'Este contrato ya está cerrado: no admite más cambios.',
            },
            byStatus: {
              403: 'Activar, expirar o cancelar un contrato es del BDC.',
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

      {/* La referencia: el documento a la izquierda, la lista de verificación a la derecha. */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ContractPaper>
          <div className="flex flex-col gap-8">
            <header className="border-b border-line pb-4">
              <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
                Documento de Términos y Condiciones
              </p>
              <h2 className="mt-1 text-2xl font-bold text-ink">{contract.number}</h2>
              <p className="mt-1 text-sm text-ink-2">
                Entre <span className="font-semibold">Oranje</span> y{' '}
                <span className="font-semibold">{contract.hotelName}</span>
                {contract.signedByName === '—'
                  ? ''
                  : ` · firma por el hotel: ${contract.signedByName}`}
              </p>
            </header>

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

            <p className="text-xs leading-relaxed text-ink-3">
              {IS_DEV_UI
                ? 'settlement toma de aquí las tarifas y los multiplicadores para calcular pago y factura. Un cambio de contrato no debe recalcular semanas ya aprobadas: por eso la vigencia tiene fecha, y el consolidado guarda lo que regía ese día.'
                : 'La nómina y la factura toman de aquí las tarifas y los multiplicadores. Un cambio de contrato no recalcula semanas ya aprobadas: la vigencia tiene fecha, y el consolidado guarda lo que regía ese día.'}
            </p>
          </div>
        </ContractPaper>

        <div className="flex flex-col gap-6">
          <ContractNextStep contract={contract} activeContractNumber={activeContractNumber} />
        </div>
      </div>
    </div>
  )
}
