import { zodResolver } from '@hookform/resolvers/zod'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { StatusLightBadge, toast } from '@oranje/ui'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'

import { useDiscardProposalDraftMutation } from '../api/onboardingApi'
import {
  useCreateProposalDraftMutation,
  useGetProposalWorkspaceQuery,
  useSaveProposalDraftMutation,
  useSendProposalMutation,
} from '../api/proposalsApi'
import { ProposalRateFields } from '../components/ProposalRateFields'
import { ProposalVersionHistory } from '../components/ProposalVersionHistory'
import { buildProposalDraftSchema, type ProposalDraftForm } from '../types/proposalDraft.schema'

import personajeEstrategia from '@/assets/ilustrations/personaje-estrategia.svg'
import personajePago from '@/assets/ilustrations/personaje-pago-procesado.svg'
import personajePresentacion from '@/assets/ilustrations/personaje-presentacion.svg'
import personajeRetro from '@/assets/ilustrations/personaje-retroalimentacion.svg'
import { Button } from '@/shared/components/Button'
import { DetailSkeleton } from '@/shared/components/DetailSkeleton'
import { FormField } from '@/shared/components/FormField'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { SectionCard } from '@/shared/components/SectionCard'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { useCan } from '@/shared/hooks/useCan'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDate } from '@/shared/lib/formatters'

/** Donde la propuesta se elabora y envía: Verde (RR-V) y Café (renegociación). */
const WORKABLE_STATUSES = new Set(['GREEN', 'BROWN'])

const FORM_ID = 'proposal-draft'

const CONTROL_CLASS =
  'w-full rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none'

/** Las diapositivas del intro; el texto se traduce al pintar con `i18n._()` (D-36). */
const INTRO_SLIDES: readonly {
  image: string
  title: MessageDescriptor
  text: MessageDescriptor
}[] = [
  {
    image: personajePresentacion,
    title: msg`La propuesta vive en Verde`,
    text: msg`Se elabora y se envía con el hotel en Verde — y de ahí no se avanza sin propuesta enviada.`,
  },
  {
    image: personajePago,
    title: msg`Se cotiza por puesto`,
    text: msg`Un renglón por puesto con su pay y su bill: es el mismo cuadro que el hotel firma en el contrato.`,
  },
  {
    image: personajeRetro,
    title: msg`Lo enviado no se edita`,
    text: msg`Cada envío congela una versión. Renegociar es abrir una nueva, que arranca con las tarifas de la anterior.`,
  },
]

export function ProposalEditorPage({
  prospectId: prospectIdProp,
  embedded = false,
}: {
  /** Embebido en la lista de Propuestas (lista-detalle): el id llega por prop. */
  prospectId?: string
  embedded?: boolean
} = {}): ReactNode {
  const { t, i18n } = useLingui()
  const params = useParams()
  const prospectId = prospectIdProp ?? params.prospectId ?? ''
  const navigate = useNavigate()

  const {
    data: workspace,
    isLoading,
    isError,
  } = useGetProposalWorkspaceQuery(prospectId, { skip: prospectId === '' })

  const [saveDraft, { isLoading: isSaving }] = useSaveProposalDraftMutation()
  const [sendProposal, { isLoading: isSending }] = useSendProposalMutation()
  /** El error del guardado/envío SE VE: tragárselo dejaba botones «muertos». */
  const [actionError, setActionError] = useState<string | null>(null)
  const [createDraft, { isLoading: isCreating, isError: hasCreateFailed }] =
    useCreateProposalDraftMutation()
  const [discardDraft, { isLoading: isDiscarding }] = useDiscardProposalDraftMutation()
  /** Descartar pide un segundo toque: es destructivo, como las demás bajas. */
  const [isDiscardArmed, setDiscardArmed] = useState(false)
  /** El intro de página se ve UNA vez; «¿Cómo funciona?» lo reabre. */
  const { isIntroOpen, dismissIntro, reopenIntro } = useIntroSeen('proposal-editor')
  const can = useCan()
  /** Elaborar, enviar y descartar son del BD dueño y del BDC, que hereda lo del BD
     (proposals:create/:send); el resto consulta. */
  const canEdit = can('proposals:create')
  /* El back rechaza abrir versión fuera de Verde/Café (PROPOSAL_STATE); el
     botón lo dice ANTES, deshabilitado con título, en vez de fallar al clic. */
  const isWorkable = workspace === undefined || WORKABLE_STATUSES.has(workspace.prospectStatus)
  const workableBlock =
    !isWorkable && workspace
      ? t`La propuesta se trabaja con el hotel en Verde o Café: este está en ${ONBOARDING_STATUS_LABEL[workspace.prospectStatus]}`
      : null

  /* Los mensajes del esquema se resuelven al armarlo, así que se rearma al
     cambiar de idioma: `i18n` no cambia de identidad al activar otro (D-36). */
  const schema = useMemo(() => buildProposalDraftSchema(i18n), [i18n, i18n.locale])

  const { register, control, handleSubmit, reset, trigger, formState } = useForm<ProposalDraftForm>(
    {
      resolver: zodResolver(schema),
      mode: 'onChange',
      defaultValues: { servicesNote: '', rates: [] },
    },
  )

  const draft = workspace?.draft ?? null
  /** La última ENVIADA: lo que se enseña cuando no hay borrador abierto. */
  const lastSent =
    workspace?.versions
      .filter((version) => version.sentAt !== null)
      .sort((a, b) => b.version - a.version)[0] ?? null

  // El formulario se rellena cuando llega el borrador, y al cambiar de versión.
  useEffect(() => {
    if (!draft) return
    reset({
      servicesNote: draft.servicesNote,
      rates: draft.rates.map((rate) => ({
        positionId: rate.positionId,
        payRate: rate.payRate,
        billRate: rate.billRate,
      })),
    })
    /*
     * `reset` NO valida: sin esto `isValid` se queda en false y los botones
     * del encabezado quedan muertos hasta que se toca un campo — un borrador
     * que llega completo debe poder guardarse o enviarse de inmediato.
     */
    void trigger()
  }, [draft, reset, trigger])

  if (isLoading) return <DetailSkeleton />

  if (isError || !workspace) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-6">
        <p className="text-sm text-red">
          <Trans>
            Este hotel no tiene propuesta o el enlace ya no sirve. Vuelve al Pipeline y ábrela desde
            su ficha.
          </Trans>
        </p>
        <Link to="/pipeline" className="text-sm font-semibold text-o-700 hover:underline">
          <Trans>Volver al Pipeline</Trans>
        </Link>
      </div>
    )
  }

  function actionErrorMessage(error: unknown): string {
    const statusLabel = workspace
      ? ONBOARDING_STATUS_LABEL[workspace.prospectStatus]
      : t`otro estado`
    return apiErrorMessage(error, {
      byCode: {
        PROPOSAL_STATE_INVALID: i18n._(
          msg`La propuesta se trabaja con el hotel en Verde o Café — este está en ${statusLabel}.`,
        ),
        PROPOSAL_SENT: i18n._(
          msg`Esta versión ya se envió: lo enviado no se edita — abre una versión nueva.`,
        ),
        PROPOSAL_WITHOUT_RATES: i18n._(
          msg`Agrega al menos un puesto con su tarifa: el cuadro es lo que el hotel acepta.`,
        ),
        RATE_MARGIN_NEGATIVE: i18n._(
          msg`Hay un puesto donde el bill rate queda por debajo del pay rate: se pierde en cada hora.`,
        ),
        RATE_DUPLICATED: i18n._(msg`Hay dos renglones para el mismo puesto: deja uno solo.`),
        POSITION_NOT_FOUND: i18n._(
          msg`Uno de los puestos ya no está en el catálogo. Recarga la página y vuelve a elegirlo.`,
        ),
      },
      fallback: i18n._(
        msg`No se pudo guardar la propuesta. Revisa las tarifas e inténtalo de nuevo.`,
      ),
    })
  }

  async function persist(values: ProposalDraftForm): Promise<void> {
    if (!draft) return
    setActionError(null)
    try {
      await saveDraft({ proposalId: draft.id, prospectId, ...values }).unwrap()
      toast.success(t`Borrador guardado`)
    } catch (error) {
      setActionError(actionErrorMessage(error))
      throw error
    }
  }

  /** Enviar guarda primero: si no, se enviaría la versión sin los cambios en pantalla. */
  async function persistAndSend(values: ProposalDraftForm): Promise<void> {
    if (!draft) return
    try {
      await persist(values)
      await sendProposal({ proposalId: draft.id, prospectId }).unwrap()
      toast.success(t`Propuesta enviada al hotel`)
    } catch (error) {
      setActionError(actionErrorMessage(error))
    }
  }

  const isBusy = isSaving || isSending || isCreating || isDiscarding

  async function discard(): Promise<void> {
    if (!draft) return
    setActionError(null)
    try {
      await discardDraft({ proposalId: draft.id, prospectId }).unwrap()
      toast.success(t`Borrador descartado`)
      void navigate(`/pipeline/${prospectId}`)
    } catch (error) {
      setDiscardArmed(false)
      setActionError(
        apiErrorMessage(error, {
          byCode: {
            PROPOSAL_NOT_DRAFT: i18n._(msg`Esta versión ya se envió: lo enviado no se descarta.`),
          },
          fallback: i18n._(msg`No se pudo descartar el borrador. Inténtalo de nuevo.`),
        }),
      )
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {!embedded && (
        <nav aria-label="Ruta" className="flex items-center gap-2 text-sm text-ink-3">
          <Link to="/pipeline" className="hover:text-o-700">
            <Trans>Pipeline</Trans>
          </Link>
          <span aria-hidden>›</span>
          <Link to={`/pipeline/${prospectId}`} className="hover:text-o-700">
            {workspace.hotelName}
          </Link>
          <span aria-hidden>›</span>
          <span className="text-ink-2">
            <Trans>Propuesta</Trans>
          </span>
        </nav>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              <Trans>Propuesta · {workspace.hotelName}</Trans>
            </h1>
            <StatusLightBadge
              token={ONBOARDING_STATUS_TOKEN[workspace.prospectStatus]}
              label={ONBOARDING_STATUS_LABEL[workspace.prospectStatus]}
            />
          </div>
          <p className="mt-1.5 text-sm text-ink-3">
            {draft
              ? IS_DEV_UI
                ? `Versión ${draft.version} · borrador · sent_at es NULL hasta enviarla`
                : t`Versión ${draft.version} · borrador sin enviar`
              : t`Sin versión abierta · la última ya se envió`}
            {draft && lastSent && (
              <span className="text-ink-2">
                {' '}
                <Trans>
                  · el hotel tiene la v{lastSent.version} (enviada{' '}
                  {lastSent.sentAt ? formatDate(lastSent.sentAt) : '—'})
                </Trans>
              </span>
            )}
            {' · '}
            <button
              type="button"
              onClick={reopenIntro}
              className="cursor-pointer font-medium text-o-700 hover:underline"
            >
              <Trans>¿Cómo funciona?</Trans>
            </button>
          </p>
        </div>

        {draft && canEdit && (
          <div className="flex items-center gap-3">
            <Button
              disabled={isBusy}
              className={isDiscardArmed ? 'bg-red text-white hover:bg-red' : 'text-red'}
              onClick={() => {
                if (!isDiscardArmed) {
                  setDiscardArmed(true)
                  toast(t`¿Seguro? Toca «Sí, descartar borrador» para confirmar.`)
                  return
                }
                void discard()
              }}
            >
              {isDiscarding ? (
                <Trans>Descartando…</Trans>
              ) : isDiscardArmed ? (
                <Trans>Sí, descartar borrador</Trans>
              ) : (
                <Trans>Descartar borrador</Trans>
              )}
            </Button>
            <Button type="submit" form={FORM_ID} disabled={!formState.isValid || isBusy}>
              {isSaving ? <Trans>Guardando…</Trans> : <Trans>Guardar borrador</Trans>}
            </Button>
            <Button
              variant="primary"
              disabled={!formState.isValid || isBusy}
              onClick={() => {
                void handleSubmit(persistAndSend)()
              }}
            >
              {isSending ? <Trans>Enviando…</Trans> : <Trans>Enviar propuesta</Trans>}
            </Button>
          </div>
        )}
      </header>

      {actionError !== null && (
        <p role="alert" className="text-sm text-red">
          {actionError}
        </p>
      )}

      {isIntroOpen ? (
        <div className="max-w-2xl rounded-lg border border-line bg-surface">
          <OnboardingIntro
            slides={INTRO_SLIDES.map((slide) => ({
              image: slide.image,
              title: i18n._(slide.title),
              text: i18n._(slide.text),
            }))}
            startLabel={t`Ir a la propuesta`}
            onDone={dismissIntro}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            {draft && !canEdit ? (
              /* Quien consulta ve VALORES, no un formulario: inputs con errores de validación parecían una captura pendiente. */
              <SectionCard title={t`Borrador v${draft.version} · en elaboración`}>
                {/* Quién lo elabora, con cara: es a quien le pides el cambio. */}
                <div className="mb-4 flex items-center gap-2.5">
                  {workspace.owner.photoUrl ? (
                    <img
                      src={workspace.owner.photoUrl}
                      alt=""
                      aria-hidden
                      className="size-8 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex size-8 items-center justify-center rounded-full bg-o-500/15 text-xs font-bold text-o-700"
                    >
                      {workspace.owner.name
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((word) => word.charAt(0))
                        .join('')
                        .toUpperCase()}
                    </span>
                  )}
                  <p className="text-sm text-ink-2">
                    <Trans>
                      Lo elabora <span className="font-semibold">{workspace.owner.name}</span> — el
                      BD dueño del ciclo — o el BDC.
                    </Trans>
                  </p>
                </div>
                <dl className="flex flex-col divide-y divide-line rounded-lg border border-line">
                  <div className="flex items-start justify-between gap-4 p-3">
                    <dt className="text-sm text-ink-3">
                      <Trans>Servicios ofrecidos</Trans>
                    </dt>
                    <dd className="text-right text-sm font-medium text-ink">
                      {draft.servicesNote || t`Aún sin describir`}
                    </dd>
                  </div>
                  {draft.rates.map((rate) => (
                    <div
                      key={rate.positionId}
                      className="flex items-center justify-between gap-4 p-3"
                    >
                      <dt className="text-sm text-ink-3">{rate.positionName}</dt>
                      <dd className="text-sm font-medium text-ink">
                        <Trans>
                          ${rate.payRate.toFixed(2)} pay · ${rate.billRate.toFixed(2)} bill
                        </Trans>
                      </dd>
                    </div>
                  ))}
                  {draft.rates.length === 0 && (
                    <div className="flex items-center justify-between gap-4 p-3">
                      <dt className="text-sm text-ink-3">
                        <Trans>Tarifas</Trans>
                      </dt>
                      <dd className="text-sm text-ink-3">
                        <Trans>Aún sin cotizar ningún puesto</Trans>
                      </dd>
                    </div>
                  )}
                </dl>
                <p className="mt-4 text-sm leading-relaxed text-ink-3">
                  <Trans>
                    Es un borrador en elaboración: los valores pueden cambiar hasta que el BD o el
                    BDC la envíen. Cuando la envíen, aquí verás la versión final.
                  </Trans>
                </p>
              </SectionCard>
            ) : draft ? (
              <form
                id={FORM_ID}
                noValidate
                onSubmit={(event) => {
                  void handleSubmit(async (values) => {
                    await persist(values).catch(() => undefined)
                  })(event)
                }}
                className="flex flex-col gap-5"
              >
                <SectionCard title={t`Servicios ofrecidos`}>
                  <FormField
                    label={t`Descripción`}
                    htmlFor="servicesNote"
                    hint={
                      IS_DEV_UI
                        ? 'services_note — texto libre'
                        : t`Qué va a cubrir Oranje en este hotel`
                    }
                    error={formState.errors.servicesNote?.message}
                  >
                    <input
                      id="servicesNote"
                      type="text"
                      placeholder={t`Housekeeping y Steward para temporada alta…`}
                      {...register('servicesNote')}
                      className={CONTROL_CLASS}
                    />
                  </FormField>
                </SectionCard>

                <SectionCard title={t`Tarifas por puesto`}>
                  <ProposalRateFields
                    control={control}
                    register={register}
                    positions={workspace.positions}
                    errors={formState.errors}
                  />

                  <p className="mt-5 rounded-md bg-o-50 p-4 text-sm leading-relaxed text-ink-2">
                    {IS_DEV_UI ? (
                      'commercial.proposal_rate — un renglón por puesto, espejo de contract_rate: al firmar se copia al Documento de T&C.'
                    ) : (
                      <Trans>
                        Este cuadro es el que firma el hotel: al crear el Documento de T&C se copia
                        tal cual, sin volver a capturarlo.
                      </Trans>
                    )}
                  </p>
                </SectionCard>
              </form>
            ) : (
              <SectionCard
                title={lastSent ? t`Última enviada · v${lastSent.version}` : t`Sin versión abierta`}
              >
                {/* Lo que la propuesta INCLUYE se ve aquí mismo, sea cual sea tu rol. */}
                {lastSent && (
                  <dl className="mb-4 flex flex-col divide-y divide-line rounded-lg border border-line">
                    <div className="flex items-start justify-between gap-4 p-3">
                      <dt className="text-sm text-ink-3">
                        <Trans>Servicios ofrecidos</Trans>
                      </dt>
                      <dd className="text-right text-sm font-medium text-ink">
                        {lastSent.servicesNote || '—'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 p-3">
                      <dt className="text-sm text-ink-3">
                        <Trans>Pay rate</Trans>
                      </dt>
                      <dd className="text-sm font-medium text-ink">
                        ${lastSent.payRate.toFixed(2)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 p-3">
                      <dt className="text-sm text-ink-3">
                        <Trans>Bill rate</Trans>
                      </dt>
                      <dd className="text-sm font-medium text-ink">
                        ${lastSent.billRate.toFixed(2)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 p-3">
                      <dt className="text-sm text-ink-3">
                        <Trans>Enviada</Trans>
                      </dt>
                      <dd className="text-sm font-medium text-ink">
                        {lastSent.sentAt ? formatDate(lastSent.sentAt) : '—'}
                        {lastSent.byName ? t` · por ${lastSent.byName}` : ''}
                      </dd>
                    </div>
                  </dl>
                )}
                <p className="text-sm leading-relaxed text-ink-3">
                  <Trans>
                    Las enviadas no se editan: para renegociar se abre una versión nueva, que
                    arranca con las tarifas de la anterior. El contrato de esta versión se abre
                    desde el historial.
                  </Trans>
                </p>
                {canEdit ? (
                  <>
                    <Button
                      variant="primary"
                      className="mt-5"
                      disabled={isBusy || !isWorkable}
                      title={workableBlock ?? undefined}
                      onClick={() => {
                        void createDraft(prospectId)
                          .unwrap()
                          .then(() => {
                            toast.success(t`Versión nueva abierta`)
                          })
                          .catch(() => {})
                      }}
                    >
                      {isCreating ? <Trans>Abriendo…</Trans> : <Trans>Abrir versión nueva</Trans>}
                    </Button>
                    {hasCreateFailed && (
                      <p role="alert" className="mt-3 text-sm text-red">
                        <Trans>
                          No se pudo abrir la versión: solo el BD dueño del ciclo o el BDC pueden
                          elaborar la propuesta.
                        </Trans>
                      </p>
                    )}
                  </>
                ) : (
                  <div className="mt-5">
                    <NoticeCard
                      image={personajeEstrategia}
                      title={t`Elaborar la propuesta es del BD o del BDC`}
                      role="status"
                    >
                      <Trans>
                        Solo el BD dueño del ciclo o el BDC abren y envían versiones. Desde tu rol
                        puedes consultarla, no editarla.
                      </Trans>
                    </NoticeCard>
                  </div>
                )}
              </SectionCard>
            )}

            <ProposalVersionHistory
              hotelName={workspace.hotelName}
              hotelAddress={workspace.hotelAddress}
              contactEmail={workspace.contactEmail}
              senderName={workspace.owner.name}
              versions={workspace.versions}
            />
          </div>
        </>
      )}
    </div>
  )
}
