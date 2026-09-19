import { Trans, useLingui } from '@lingui/react/macro'
import { toast } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import {
  useGetContractsQuery,
  useGetContractQuery,
  useTransitionContractMutation,
} from '../api/contractsApi'
import { ActivateContractDialog } from '../components/ActivateContractDialog'
import { buildContractChecks } from '../components/ContractChecklist'
import { ContractNextStep } from '../components/ContractNextStep'
import { ContractPaper } from '../components/ContractPaper'
import { ContractPdfButton } from '../components/ContractPdfButton'
import { EditRateDialog } from '../components/EditRateDialog'
import { MultiplierTable } from '../components/MultiplierTable'
import { NewContractDialog } from '../components/NewContractDialog'
import { RateTable } from '../components/RateTable'
import { ANY_VALUE } from '../types/contract.types'

import personajeContratacion from '@/assets/ilustrations/personaje-contratacion.svg'
import { Button } from '@/shared/components/Button'
import { DetailSkeleton } from '@/shared/components/DetailSkeleton'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { SectionCard } from '@/shared/components/SectionCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TOKEN } from '@/shared/constants/contractStatus'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDate, weekdayName } from '@/shared/lib/formatters'

/**
 * La ficha del contrato, a ancho completo y con su propia ruta.
 *
 * Vivía embebida junto a una lista, pero con un contrato por hotel esa lista
 * dejaba dos tercios de columna vacíos y partía la ficha en una tira angosta.
 * Ahora se llega desde la tarjeta del hotel, como al detalle de un prospecto.
 */
export function ContractDetailPage(): ReactNode {
  const { t, i18n } = useLingui()
  const params = useParams()
  const contractId = params.contractId ?? ''

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

  /* Quién rige hoy en ese hotel: lo necesita el aviso de activar y antes lo
     sabía la lista. Sin lista, se resuelve aquí. */
  const { data: list } = useGetContractsQuery({
    search: '',
    status: ANY_VALUE,
    zoneName: ANY_VALUE,
    expiresInDays: null,
  })
  const activeContractNumber =
    list?.items.find(
      (row) =>
        row.hotelName === contract?.hotelName && row.status === 'ACTIVE' && row.id !== contractId,
    )?.number ?? null

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
  /* Activar no se confirma con un segundo clic como los demás: abre un diálogo
     que explica qué se enciende, porque es lo que arranca el dinero del hotel. */
  const [isActivateOpen, setActivateOpen] = useState(false)
  const [isRenewOpen, setRenewOpen] = useState(false)

  async function run(action: 'activate' | 'expire' | 'cancel'): Promise<void> {
    if (action !== 'activate' && confirming !== action) {
      setConfirming(action)
      return
    }
    setConfirming(null)
    setPendingAction(action)
    try {
      await transition({ contractId, action }).unwrap()
      toast.success(
        action === 'activate'
          ? t`Contrato ${contract?.number ?? ''} activado`
          : action === 'cancel'
            ? t`Borrador cancelado`
            : t`Contrato marcado como expirado`,
      )
    } catch {
      return
    } finally {
      setPendingAction(null)
      setActivateOpen(false)
    }
  }

  if (isFetching && !contract) {
    return <DetailSkeleton />
  }

  if (isError || !contract) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-6">
        <p className="text-sm text-red">
          <Trans>Este contrato no existe o fue borrado. Vuelve a la lista y elige otro.</Trans>
        </p>
        <Link to="/contracts" className="text-sm font-semibold text-o-700 hover:underline">
          <Trans>Volver a Contratos</Trans>
        </Link>
      </div>
    )
  }

  const validityFields = [
    { label: t`Desde`, value: formatDate(contract.validFrom), foot: 'valid_from' },
    {
      label: t`Hasta`,
      value: contract.validTo === null ? t`Indefinido` : formatDate(contract.validTo),
      foot: 'valid_to · nulo = indefinido',
    },
    {
      label: t`Semana`,
      value: `${weekdayName(contract.weekStartDay) || '—'} → ${weekdayName(contract.weekEndDay) || '—'}`,
      foot: `week_start_day ${String(contract.weekStartDay)} · week_end_day ${String(contract.weekEndDay)}`,
    },
    { label: t`Número`, value: contract.number, foot: 'number · único' },
  ]

  /* El botón de activar respeta la lista: si hay un problema, el motor lo rechazaría igual. */
  const hasFailingChecks = buildContractChecks(contract, i18n).some(
    (check) => check.status === 'fail',
  )

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={t`Ruta`} className="flex items-center gap-2 text-sm text-ink-3">
        <Link to="/contracts" className="hover:text-o-700">
          <Trans>Contratos</Trans>
        </Link>
        <span aria-hidden>/</span>
        <span className="font-semibold text-ink-2">{contract.hotelName}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              <Trans>Contrato {contract.number}</Trans>
            </h1>
            <StatusLightSoftBadge
              token={CONTRACT_STATUS_TOKEN[contract.status]}
              label={CONTRACT_STATUS_LABEL[contract.status]}
            />
          </div>
          <p className="mt-1.5 text-sm text-ink-3">
            {IS_DEV_UI && 'commercial.contract · '}
            {contract.signedByName === '—' ? (
              <Trans>
                {contract.hotelName} · firmado el {formatDate(contract.signedAt)}
              </Trans>
            ) : (
              <Trans>
                {contract.hotelName} · firmado por {contract.signedByName} el{' '}
                {formatDate(contract.signedAt)}
              </Trans>
            )}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          <ContractPdfButton contract={contract} />

          {/* Renovar es el único alta que no viene de una propuesta: es el
              mismo hotel, con el cuadro del contrato que vence. */}
          {contract.status !== 'DRAFT' && canApprove && (
            <Button
              variant="secondary"
              onClick={() => {
                setRenewOpen(true)
              }}
            >
              <Trans>Renovar contrato</Trans>
            </Button>
          )}

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
                  <Trans>Editar tarifas</Trans>
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
                    {pendingAction === 'cancel' ? (
                      <Trans>Cancelando…</Trans>
                    ) : confirming === 'cancel' ? (
                      <Trans>Sí, cancelar borrador</Trans>
                    ) : (
                      <Trans>Cancelar borrador</Trans>
                    )}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={isTransitioning || hasFailingChecks}
                    title={
                      hasFailingChecks
                        ? t`Antes hay que resolver lo que dice «Qué sigue»`
                        : undefined
                    }
                    onClick={() => {
                      setActivateOpen(true)
                    }}
                  >
                    {pendingAction === 'activate' ? (
                      <Trans>Activando…</Trans>
                    ) : (
                      <Trans>Activar contrato</Trans>
                    )}
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
              {pendingAction === 'expire' ? (
                <Trans>Marcando…</Trans>
              ) : confirming === 'expire' ? (
                <Trans>Sí, marcar expirado</Trans>
              ) : (
                <Trans>Marcar expirado</Trans>
              )}
            </Button>
          )}
        </div>
      </header>

      {/* Sin approve, la acción que da sentido al borrador se explica: quién sigue. */}
      {contract.status === 'DRAFT' && !canApprove && (
        <NoticeCard image={personajeContratacion} title={t`Activar es del BDC`} role="status">
          <Trans>
            Este borrador lo activa el BDC cuando la verificación de «Qué sigue» esté en verde: al
            activarlo, el contrato pasa a regir la nómina y la factura del hotel.
          </Trans>
        </NoticeCard>
      )}

      {hasTransitionFailed && (
        <p role="alert" className="text-sm text-red">
          {apiErrorMessage(error, {
            byCode: {
              CONTRACT_WITHOUT_RATES: t`No se puede activar sin tarifas: agrega al menos una.`,
              CONTRACT_ALREADY_ACTIVE: t`Este hotel ya tiene un contrato vigente: primero hay que expirarlo.`,
              CONTRACT_NOT_DRAFT: t`Este contrato ya no es borrador: no se puede editar ni cancelar.`,
              CONTRACT_NOT_ACTIVE: t`Solo un contrato vigente se puede marcar expirado.`,
              CONTRACT_ALREADY_CLOSED: t`Este contrato ya está cerrado: no admite más cambios.`,
            },
            byStatus: {
              403: t`Activar, expirar o cancelar un contrato es del BDC.`,
            },
            fallback: t`No se pudo cambiar el estado del contrato. Inténtalo de nuevo.`,
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

      <NewContractDialog
        isOpen={isRenewOpen}
        onClose={() => {
          setRenewOpen(false)
        }}
        hotel={{ id: contract.hotelId, name: contract.hotelName }}
        initialRates={contract.rates.map((rate) => ({
          catalogPositionId: rate.catalogPositionId,
          payRate: rate.payRate.toFixed(2),
          billRate: rate.billRate.toFixed(2),
        }))}
      />

      <ActivateContractDialog
        isOpen={isActivateOpen}
        onClose={() => {
          setActivateOpen(false)
        }}
        onConfirm={() => {
          void run('activate')
        }}
        isActivating={pendingAction === 'activate'}
        contract={contract}
        activeContractNumber={activeContractNumber}
      />

      {/* La referencia: el documento a la izquierda, la lista de verificación a la derecha. */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ContractPaper>
          <div className="flex flex-col gap-8">
            <header className="border-b border-line pb-4">
              <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
                <Trans>Documento de Términos y Condiciones</Trans>
              </p>
              <h2 className="mt-1 text-2xl font-bold text-ink">{contract.number}</h2>
              <p className="mt-1 text-sm text-ink-2">
                <Trans>
                  Entre <span className="font-semibold">Oranje</span> y{' '}
                  <span className="font-semibold">{contract.hotelName}</span>
                </Trans>
                {contract.signedByName === '—' ? (
                  ''
                ) : (
                  <Trans> · firma por el hotel: {contract.signedByName}</Trans>
                )}
              </p>
            </header>

            <SectionCard
              title={t`Vigencia y semana de nómina`}
              subtitle={
                IS_DEV_UI
                  ? 'valid_from · valid_to · week_start_day · week_end_day'
                  : t`La semana de nómina la fija el contrato`
              }
            >
              {/* Dos columnas como máximo: el documento vive en el tercio
                  izquierdo de la pantalla y con cuatro los valores largos
                  («Indefinido», «Lunes → Domingo», el folio) se encimaban unos
                  sobre otros y quedaban ilegibles. */}
              <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {validityFields.map((field) => (
                  <div key={field.label} className="min-w-0">
                    <dt className="text-sm text-ink-3">{field.label}</dt>
                    <dd className="mt-1 text-lg font-bold break-words text-ink">{field.value}</dd>
                    {IS_DEV_UI && (
                      <p className="mt-1 text-xs break-words text-ink-3">{field.foot}</p>
                    )}
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
              {IS_DEV_UI ? (
                'settlement toma de aquí las tarifas y los multiplicadores para calcular pago y factura. Un cambio de contrato no debe recalcular semanas ya aprobadas: por eso la vigencia tiene fecha, y el consolidado guarda lo que regía ese día.'
              ) : (
                <Trans>
                  La nómina y la factura toman de aquí las tarifas y los multiplicadores. Un cambio
                  de contrato no recalcula semanas ya aprobadas: la vigencia tiene fecha, y el
                  consolidado guarda lo que regía ese día.
                </Trans>
              )}
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
