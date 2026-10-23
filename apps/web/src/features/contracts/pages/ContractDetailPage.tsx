import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon, toast } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import {
  useGetContractsQuery,
  useGetContractQuery,
  useLockContractMutation,
  useTransitionContractMutation,
  useUpdateContractMutation,
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
import { UnlockContractDialog } from '../components/UnlockContractDialog'
import { ANY_VALUE } from '../types/contract.types'

import personajeContratacion from '@/assets/ilustrations/personaje-contratacion.svg'
import { BlockedAction, BlockedReasons } from '@/shared/components/BlockedAction'
import { Button } from '@/shared/components/Button'
import { ContractDocument, PROVIDER } from '@/shared/components/ContractDocument'
import { DateField } from '@/shared/components/DateField'
import { DetailSkeleton } from '@/shared/components/DetailSkeleton'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { SectionCard } from '@/shared/components/SectionCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TOKEN } from '@/shared/constants/contractStatus'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDate, weekdayName } from '@/shared/lib/formatters'

const CONTROL_CLASS =
  'w-full rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none'

/**
 * La ficha del contrato: inputs del machote a la izquierda, el documento real
 * en vivo a la derecha — mismo patrón que la Propuesta (Hugo, 2026-10-20).
 * Embebible en la lista de Contratos (lista-detalle) igual que
 * `ProposalEditorPage`: el id llega por prop o por la URL.
 */
export function ContractDetailPage({
  contractId: contractIdProp,
  embedded = false,
}: {
  contractId?: string
  embedded?: boolean
} = {}): ReactNode {
  const { t, i18n } = useLingui()
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
  const [isEditingDocument, setIsEditingDocument] = useState(false)
  const [isEditingValidity, setIsEditingValidity] = useState(false)
  const [validToDraft, setValidToDraft] = useState('')
  const [
    updateValidity,
    { isLoading: isSavingValidity, isError: hasValidityError, error: validityError },
  ] = useUpdateContractMutation()
  /** Los cierres piden un segundo clic: el botón se vuelve «¿Confirmar…?». */
  const [confirming, setConfirming] = useState<'activate' | 'expire' | 'cancel' | null>(null)
  const [transition, { isLoading: isTransitioning, isError: hasTransitionFailed, error }] =
    useTransitionContractMutation()

  /* Campos del machote del Service Agreement (Hugo, 2026-10-20): se editan
     aquí mismo, y el documento de la derecha los refleja en vivo antes de
     guardar — mismo patrón que la Propuesta. */
  const [propertyName, setPropertyName] = useState('')
  const [propertyAddress, setPropertyAddress] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [serviceProviderName, setServiceProviderName] = useState('')
  const [serviceProviderEmail, setServiceProviderEmail] = useState('')
  const [
    updateContract,
    { isLoading: isSavingFields, isError: hasDocumentError, error: documentError },
  ] = useUpdateContractMutation()

  /** Cambiar de contrato desarma cualquier confirmación a medias. */
  useEffect(() => {
    setConfirming(null)
    setIsEditingRate(false)
    setIsEditingDocument(false)
    setIsEditingValidity(false)
    setUnlockOpen(false)
  }, [contractId])

  const [pendingAction, setPendingAction] = useState<'activate' | 'expire' | 'cancel' | null>(null)
  /* Activar no se confirma con un segundo clic como los demás: abre un diálogo
     que explica qué se enciende, porque es lo que arranca el dinero del hotel. */
  const [isActivateOpen, setActivateOpen] = useState(false)
  const [isRenewOpen, setRenewOpen] = useState(false)
  const [isUnlockOpen, setUnlockOpen] = useState(false)
  const [lockContract, { isLoading: isLocking }] = useLockContractMutation()

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

  /** Volver a bloquear no pide motivo: ahí no se arriesga nada. */
  async function handleLock(): Promise<void> {
    try {
      await lockContract({ contractId }).unwrap()
      toast.success(t`Contrato bloqueado`)
    } catch {
      return
    }
  }

  /* Se prellenan al llegar ESTE contrato, y al cambiar de contrato en la
     lista — mismo criterio que el `reset()` de la Propuesta: lo que ya hay se
     respeta, nunca se inventa. Nombre y dirección caen al mismo valor que ya
     usa el documento sin ellos (el hotel), y la razón social al mismo
     `PROVIDER` fijo del machote — así el input nunca se ve vacío sin que lo
     esté: muestra el mismo valor que ya está saliendo en la vista previa, no
     uno inventado (Hugo, 2026-10-20). */
  useEffect(() => {
    if (!contract) return
    setPropertyName(contract.propertyName ?? contract.hotelName)
    setPropertyAddress(contract.propertyAddress ?? contract.hotelAddress ?? '')
    setCompanyEmail(contract.companyEmail ?? '')
    setServiceProviderName(contract.serviceProviderName ?? PROVIDER)
    setServiceProviderEmail(contract.serviceProviderEmail ?? '')
  }, [contract])

  async function saveFields(): Promise<void> {
    try {
      await updateContract({
        contractId,
        propertyName: propertyName.trim() === '' ? null : propertyName.trim(),
        propertyAddress: propertyAddress.trim() === '' ? null : propertyAddress.trim(),
        companyEmail: companyEmail.trim() === '' ? null : companyEmail.trim(),
        serviceProviderName: serviceProviderName.trim() === '' ? null : serviceProviderName.trim(),
        serviceProviderEmail:
          serviceProviderEmail.trim() === '' ? null : serviceProviderEmail.trim(),
      }).unwrap()
      toast.success(t`Datos del documento guardados`)
      setIsEditingDocument(false)
    } catch {
      return
    }
  }

  async function saveValidity(): Promise<void> {
    try {
      await updateValidity({
        contractId,
        validTo: validToDraft === '' ? null : validToDraft,
      }).unwrap()
      toast.success(t`Vigencia actualizada`)
      setIsEditingValidity(false)
    } catch {
      return
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

  /* El botón de activar respeta la lista: si hay un problema, el motor lo rechazaría igual. */
  const failingChecks = buildContractChecks(contract, i18n).filter(
    (check) => check.status === 'fail',
  )
  const activateBlockers = failingChecks.map((check) => check.detail)
  const hasFailingChecks = activateBlockers.length > 0
  /* Enviar también exige tarifas (Hugo, 2026-10-23): al hotel no le llega un
     contrato con el cuadro vacío. El servidor lo rechaza igual. */
  const sendBlockers = failingChecks
    .filter((check) => check.id === 'rates')
    .map((check) => check.detail)
  const isSendBlockShown =
    canEditRates &&
    contract.status === 'DRAFT' &&
    contract.sentAt === null &&
    sendBlockers.length > 0

  /* El candado (Hugo, 2026-10-21; ampliado a los enviados el 2026-10-23):
     el contrato ACTIVO y el Borrador que ya se envió al hotel, igual que la
     Propuesta enviada. Un Borrador sin enviar se edita libre. */
  const isSent = contract.status === 'DRAFT' && contract.sentAt !== null
  const isLockable = contract.status === 'ACTIVE' || isSent
  const isLocked = isLockable && !contract.isUnlocked

  /* Mismo criterio que antes abría el modal «Editar contrato»: solo en
     Borrador/Activo, con el permiso, y sin el candado puesto. */
  const canEditContractTerms =
    ['DRAFT', 'ACTIVE'].includes(contract.status) && canEditRates && !isLocked

  /** Vuelve a lo ya guardado: igual que cerrar el modal sin guardar. */
  function cancelEditingDocument(): void {
    setPropertyName(contract?.propertyName ?? contract?.hotelName ?? '')
    setPropertyAddress(contract?.propertyAddress ?? contract?.hotelAddress ?? '')
    setCompanyEmail(contract?.companyEmail ?? '')
    setServiceProviderName(contract?.serviceProviderName ?? PROVIDER)
    setServiceProviderEmail(contract?.serviceProviderEmail ?? '')
    setIsEditingDocument(false)
  }

  /* El documento vive de lo que se está tecleando, no de lo ya guardado —
     mismo criterio que la Propuesta: lo que se ve es lo que se está
     escribiendo, no una instantánea vieja. */
  const documentInput = {
    hotelName: contract.hotelName,
    propertyName: propertyName || null,
    propertyAddress: propertyAddress || null,
    companyEmail: companyEmail || null,
    serviceProviderName: serviceProviderName || null,
    serviceProviderEmail: serviceProviderEmail || null,
    rates: contract.rates.map((rate) => ({
      key: rate.id,
      positionName: rate.positionName,
      billRate: rate.billRate,
    })),
    startDate: contract.validFrom,
    endDate: contract.validTo,
  }

  return (
    <div className="flex flex-col gap-6">
      {!embedded && (
        <nav aria-label={t`Ruta`} className="flex items-center gap-2 text-sm text-ink-3">
          <Link to="/contracts" className="hover:text-o-700">
            <Trans>Contratos</Trans>
          </Link>
          <span aria-hidden>/</span>
          <span className="font-semibold text-ink-2">{contract.hotelName}</span>
        </nav>
      )}

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
            {isSent && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-o-50 px-3 py-1.5 text-sm font-medium text-o-700">
                <MaterialIcon name="send" aria-hidden className="text-base" />
                <Trans>Enviado</Trans>
              </span>
            )}
            {isLockable && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-sm font-medium text-ink-3">
                <MaterialIcon
                  name={isLocked ? 'lock' : 'lock_open'}
                  aria-hidden
                  className="text-base"
                />
                {isLocked ? <Trans>Bloqueado</Trans> : <Trans>Desbloqueado</Trans>}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm text-ink-3">
            {IS_DEV_UI && 'commercial.contract · '}
            {/* Sin activar no hay firma: antes un borrador decía «firmado el
                …» con su fecha de creación (Hugo, 2026-10-23). El hotel firma
                fuera del sistema; aquí consta cuándo se activó y quién. */}
            {contract.signedAt !== null ? (
              contract.signedByName !== null ? (
                <Trans>
                  {contract.hotelName} · activado por {contract.signedByName} el{' '}
                  {formatDate(contract.signedAt)}
                </Trans>
              ) : (
                <Trans>
                  {contract.hotelName} · activado el {formatDate(contract.signedAt)}
                </Trans>
              )
            ) : contract.sentAt !== null ? (
              contract.sentByName !== null ? (
                <Trans>
                  {contract.hotelName} · enviado por {contract.sentByName} el{' '}
                  {formatDate(contract.sentAt)}
                </Trans>
              ) : (
                <Trans>
                  {contract.hotelName} · enviado el {formatDate(contract.sentAt)}
                </Trans>
              )
            ) : (
              <Trans>
                {contract.hotelName} · borrador creado el {formatDate(contract.createdAt)}
              </Trans>
            )}
            {contract.proposal ? (
              <span>
                {' · '}
                <Link
                  to={`/proposals/${contract.proposal.prospectId}/${String(contract.proposal.version)}`}
                  className="font-medium text-o-700 hover:underline"
                >
                  <Trans>Propuesta v{contract.proposal.version}</Trans>
                </Link>
              </span>
            ) : (
              <span className="text-ink-4">
                {' · '}
                <Trans>sin propuesta de origen</Trans>
              </span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          <ContractPdfButton
            contract={contract}
            canSend={canEditRates}
            sendBlockers={sendBlockers}
          />

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

          {/* El candado (Hugo, 2026-10-21): mismo rol que activa/aprueba.
              Desbloquear pide motivo (abre el diálogo); bloquear no, ahí no
              se arriesga nada. Aplica también al borrador enviado. */}
          {isLockable && canApprove && (
            <Button
              variant="secondary"
              disabled={isLocking}
              onClick={() => {
                if (isLocked) {
                  setUnlockOpen(true)
                } else {
                  void handleLock()
                }
              }}
            >
              <span className="flex items-center gap-1.5">
                <MaterialIcon
                  name={isLocked ? 'lock_open' : 'lock'}
                  aria-hidden
                  className="text-base"
                />
                {isLocked ? (
                  <Trans>Desbloquear</Trans>
                ) : isLocking ? (
                  <Trans>Bloqueando…</Trans>
                ) : (
                  <Trans>Bloquear</Trans>
                )}
              </span>
            </Button>
          )}

          {/* Editar tarifas y términos: en Borrador y también ya ACTIVO
              (Hugo, 2026-10-16) — lo ya pagado está a salvo porque la
              nómina copia la tarifa vigente al generarse. Solo EXPIRED y
              CANCELLED cierran la puerta, y ahora también el candado si
              está puesto (Hugo, 2026-10-21). */}
          {canEditContractTerms && (
            <Button
              variant="secondary"
              onClick={() => {
                setIsEditingRate(true)
              }}
            >
              <Trans>Editar tarifas</Trans>
            </Button>
          )}

          {/* El resto de las acciones depende del estado: DRAFT se cancela y activa. */}
          {contract.status === 'DRAFT' && (
            <>
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
                  <BlockedAction reasons={activateBlockers} title={t`Antes de activar:`}>
                    <Button
                      variant="primary"
                      disabled={isTransitioning || hasFailingChecks}
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
                  </BlockedAction>
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

      {/* Una sola lista en rojo: lo que impide enviar (las tarifas) también
          impide activar, y repetirlo dos veces solo estorba. */}
      {contract.status === 'DRAFT' && canApprove ? (
        <BlockedReasons
          reasons={activateBlockers}
          title={isSendBlockShown ? t`Antes de enviar o activar:` : t`Antes de activar:`}
        />
      ) : (
        isSendBlockShown && <BlockedReasons reasons={sendBlockers} title={t`Antes de enviar:`} />
      )}

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
              CONTRACT_NOT_DRAFT: t`Solo un borrador se cancela.`,
              CONTRACT_CLOSED: t`Este contrato ya está cerrado: no admite más cambios.`,
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
        rates={contract.rates}
        isOpen={isEditingRate}
        onClose={() => {
          setIsEditingRate(false)
        }}
      />

      <NewContractDialog
        isOpen={isRenewOpen}
        isRenewal
        onClose={() => {
          setRenewOpen(false)
        }}
        hotel={{ id: contract.hotelId, name: contract.hotelName }}
        /* El que ya está vigente, no la propuesta otra vez: si se corrigió
           aquí desde que se creó, la propuesta vieja ya no es la verdad
           (Hugo, 2026-10-20). */
        initialPropertyName={contract.propertyName}
        initialPropertyAddress={contract.propertyAddress ?? contract.hotelAddress}
        /* Se hereda del contrato que se renueva, no de una propuesta nueva
           (Hugo, 2026-10-21): una renovación no nace de un nuevo ciclo de
           ventas, sigue siendo la misma propuesta de origen. Sin prospectId:
           eso dispararía otra vez el aviso al BD, que ya se mandó cuando se
           creó este contrato. */
        proposalId={contract.proposal?.id ?? null}
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

      <UnlockContractDialog
        contractId={contractId}
        isOpen={isUnlockOpen}
        onClose={() => {
          setUnlockOpen(false)
        }}
      />

      {/* Inputs del machote a la izquierda, el documento real en vivo a la
          derecha — mismo patrón que la Propuesta (Hugo, 2026-10-20). */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative flex flex-col gap-6">
          <SectionCard
            title={t`Datos del documento`}
            subtitle={
              IS_DEV_UI
                ? 'property_name · property_address · company_email · service_provider_name · service_provider_email'
                : t`Lo que el machote necesita y hoy no venía de ningún lado`
            }
            action={
              canEditContractTerms ? (
                <button
                  type="button"
                  aria-pressed={isEditingDocument}
                  aria-label={
                    isEditingDocument
                      ? t`Cancelar edición de datos del documento`
                      : t`Editar datos del documento`
                  }
                  onClick={() => {
                    if (isEditingDocument) {
                      cancelEditingDocument()
                    } else {
                      setIsEditingDocument(true)
                    }
                  }}
                  className="shrink-0 rounded-md p-1.5 text-ink-3 hover:bg-o-50 hover:text-o-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
                >
                  <MaterialIcon
                    name={isEditingDocument ? 'close' : 'edit'}
                    aria-hidden
                    className="text-lg"
                  />
                </button>
              ) : undefined
            }
          >
            {hasDocumentError && (
              <p role="alert" className="mb-4 text-sm text-red">
                {apiErrorMessage(documentError, {
                  byCode: {
                    CONTRACT_CLOSED: t`Este contrato ya está cerrado: no admite más cambios.`,
                  },
                  fallback: t`No se pudo guardar. Inténtalo de nuevo.`,
                })}
              </p>
            )}
            {isEditingDocument ? (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink-2">
                    <Trans>Nombre de la propiedad</Trans>
                  </span>
                  <input
                    value={propertyName}
                    onChange={(event) => {
                      setPropertyName(event.target.value)
                    }}
                    placeholder={t`Nombre del hotel en el documento`}
                    className={CONTROL_CLASS}
                    autoFocus
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink-2">
                    <Trans>Dirección de la propiedad</Trans>
                  </span>
                  <input
                    value={propertyAddress}
                    onChange={(event) => {
                      setPropertyAddress(event.target.value)
                    }}
                    placeholder={t`Calle, ciudad y estado`}
                    className={CONTROL_CLASS}
                  />
                </label>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-ink-2">
                      <Trans>Correo del hotel</Trans>
                    </span>
                    <input
                      type="email"
                      value={companyEmail}
                      onChange={(event) => {
                        setCompanyEmail(event.target.value)
                      }}
                      placeholder="gerencia@hotel.com"
                      className={CONTROL_CLASS}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-ink-2">
                      <Trans>Razón social de Oranje</Trans>
                    </span>
                    <input
                      value={serviceProviderName}
                      onChange={(event) => {
                        setServiceProviderName(event.target.value)
                      }}
                      placeholder="Orange Solutions & Operations, LLC"
                      className={CONTROL_CLASS}
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink-2">
                    <Trans>Correo de Oranje en el documento</Trans>
                  </span>
                  <input
                    type="email"
                    value={serviceProviderEmail}
                    onChange={(event) => {
                      setServiceProviderEmail(event.target.value)
                    }}
                    placeholder="irene@oranjepeople.com"
                    className={CONTROL_CLASS}
                  />
                </label>
                <div className="flex justify-end gap-3 border-t border-line pt-4">
                  <Button variant="secondary" onClick={cancelEditingDocument}>
                    <Trans>Cancelar</Trans>
                  </Button>
                  <Button
                    variant="primary"
                    disabled={isSavingFields}
                    onClick={() => {
                      void saveFields()
                    }}
                  >
                    {isSavingFields ? <Trans>Guardando…</Trans> : <Trans>Guardar cambios</Trans>}
                  </Button>
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="text-sm text-ink-3">
                    <Trans>Nombre de la propiedad</Trans>
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-ink">
                    {contract.propertyName || contract.hotelName}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm text-ink-3">
                    <Trans>Dirección de la propiedad</Trans>
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-ink">
                    {contract.propertyAddress || contract.hotelAddress || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-ink-3">
                    <Trans>Correo del hotel</Trans>
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-ink">
                    {contract.companyEmail || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-ink-3">
                    <Trans>Razón social de Oranje</Trans>
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-ink">
                    {contract.serviceProviderName || PROVIDER}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm text-ink-3">
                    <Trans>Correo de Oranje en el documento</Trans>
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-ink">
                    {contract.serviceProviderEmail || '—'}
                  </dd>
                </div>
              </dl>
            )}
          </SectionCard>

          <SectionCard
            title={t`Vigencia y semana de nómina`}
            subtitle={
              IS_DEV_UI
                ? 'valid_from · valid_to · week_start_day · week_end_day'
                : t`La semana de nómina la fija el contrato`
            }
            action={
              canEditContractTerms ? (
                <button
                  type="button"
                  aria-pressed={isEditingValidity}
                  aria-label={
                    isEditingValidity ? t`Cancelar edición de vigencia` : t`Editar vigencia`
                  }
                  onClick={() => {
                    if (isEditingValidity) {
                      setIsEditingValidity(false)
                    } else {
                      setValidToDraft(contract.validTo ?? '')
                      setIsEditingValidity(true)
                    }
                  }}
                  className="shrink-0 rounded-md p-1.5 text-ink-3 hover:bg-o-50 hover:text-o-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
                >
                  <MaterialIcon
                    name={isEditingValidity ? 'close' : 'edit'}
                    aria-hidden
                    className="text-lg"
                  />
                </button>
              ) : undefined
            }
          >
            {hasValidityError && (
              <p role="alert" className="mb-4 text-sm text-red">
                {apiErrorMessage(validityError, {
                  byCode: {
                    CONTRACT_CLOSED: t`Este contrato ya está cerrado: no admite más cambios.`,
                    VALIDITY_BACKWARDS: t`La fecha de fin tiene que ser posterior al inicio.`,
                  },
                  fallback: t`No se pudo guardar. Inténtalo de nuevo.`,
                })}
              </p>
            )}
            <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-sm text-ink-3">
                  <Trans>Desde</Trans>
                </dt>
                <dd className="mt-1 text-lg font-bold break-words text-ink">
                  {formatDate(contract.validFrom)}
                </dd>
                {IS_DEV_UI && <p className="mt-1 text-xs break-words text-ink-3">valid_from</p>}
              </div>
              <div className="min-w-0">
                <dt className="text-sm text-ink-3">
                  <Trans>Hasta</Trans>
                </dt>
                {isEditingValidity ? (
                  <dd className="mt-1">
                    <DateField
                      value={validToDraft}
                      onChange={setValidToDraft}
                      min={contract.validFrom}
                      aria-label={t`Hasta`}
                    />
                  </dd>
                ) : (
                  <dd className="mt-1 text-lg font-bold break-words text-ink">
                    {contract.validTo === null ? t`Indefinido` : formatDate(contract.validTo)}
                  </dd>
                )}
                {IS_DEV_UI && (
                  <p className="mt-1 text-xs break-words text-ink-3">
                    valid_to · nulo = indefinido
                  </p>
                )}
              </div>
              <div className="min-w-0">
                <dt className="text-sm text-ink-3">
                  <Trans>Semana</Trans>
                </dt>
                <dd className="mt-1 text-lg font-bold break-words text-ink">
                  {weekdayName(contract.weekStartDay) || '—'} →{' '}
                  {weekdayName(contract.weekEndDay) || '—'}
                </dd>
                {IS_DEV_UI && (
                  <p className="mt-1 text-xs break-words text-ink-3">
                    week_start_day {String(contract.weekStartDay)} · week_end_day{' '}
                    {String(contract.weekEndDay)}
                  </p>
                )}
              </div>
              <div className="min-w-0">
                <dt className="text-sm text-ink-3">
                  <Trans>Número</Trans>
                </dt>
                <dd className="mt-1 text-lg font-bold break-words text-ink">{contract.number}</dd>
                {IS_DEV_UI && <p className="mt-1 text-xs break-words text-ink-3">number · único</p>}
              </div>
            </dl>
            {isEditingValidity && (
              <div className="mt-4 flex justify-end gap-3 border-t border-line pt-4">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsEditingValidity(false)
                  }}
                >
                  <Trans>Cancelar</Trans>
                </Button>
                <Button
                  variant="primary"
                  disabled={isSavingValidity}
                  onClick={() => {
                    void saveValidity()
                  }}
                >
                  {isSavingValidity ? <Trans>Guardando…</Trans> : <Trans>Guardar cambios</Trans>}
                </Button>
              </div>
            )}
          </SectionCard>

          <MultiplierTable
            // Remonta entero al cambiar de contrato: su propio `isEditing` no
            // se resetea solo, y sin esto se quedaba mostrando los inputs de
            // edición del contrato anterior sobre los datos del nuevo.
            key={contractId}
            contractId={contractId}
            overtime={contract.multipliers.overtime}
            holiday={contract.multipliers.holiday}
            mealDeductionAmount={contract.mealDeductionAmount}
            splitsInvoiceByMonth={contract.splitsInvoiceByMonth}
            canEdit={canEditContractTerms}
          />

          <RateTable rates={contract.rates} />

          <ContractNextStep contract={contract} activeContractNumber={activeContractNumber} />

          {/* Mismo patrón que «Semana cerrada» del Timesheet: cubre TODO el
              bloque de un vistazo, no tarjeta por tarjeta — y es decorativo
              (`pointer-events-none`), el candado real ya quitó los lápices;
              esto solo hace que bloqueado sea lo primero que se ve
              (Hugo, 2026-10-21). */}
          {isLocked && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center rounded-lg bg-ink-4/20 pt-8"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/90 px-4 py-2 text-sm font-bold text-white shadow-lg">
                <MaterialIcon name="lock" className="text-base" aria-hidden />
                <Trans>Contrato bloqueado</Trans>
              </span>
            </div>
          )}
        </div>

        <SectionCard title={t`Vista previa del documento`}>
          <p className="-mt-2 mb-4 text-xs text-ink-3">
            <Trans>
              Se genera automáticamente a partir de los campos de arriba — no se edita aquí.
            </Trans>
          </p>
          <ContractPaper>
            <ContractDocument {...documentInput} />
          </ContractPaper>
        </SectionCard>
      </div>
    </div>
  )
}
