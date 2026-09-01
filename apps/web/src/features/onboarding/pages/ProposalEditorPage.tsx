import { zodResolver } from '@hookform/resolvers/zod'
import { cn, StatusLightBadge, toast } from '@oranje/ui'
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'

import { useDiscardProposalDraftMutation } from '../api/onboardingApi'
import {
  useCreateProposalDraftMutation,
  useGetProposalWorkspaceQuery,
  useSaveProposalDraftMutation,
  useSendProposalMutation,
} from '../api/proposalsApi'
import { ProposalVersionHistory } from '../components/ProposalVersionHistory'
import { proposalDraftSchema, type ProposalDraftForm } from '../types/proposalDraft.schema'

import personajePago from '@/assets/ilustrations/personaje-pago-procesado.svg'
import personajePresentacion from '@/assets/ilustrations/personaje-presentacion.svg'
import personajeRetro from '@/assets/ilustrations/personaje-retroalimentacion.svg'
import { Button } from '@/shared/components/Button'
import { DetailSkeleton } from '@/shared/components/DetailSkeleton'
import { FormField } from '@/shared/components/FormField'
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

const FORM_ID = 'proposal-draft'

const CONTROL_CLASS =
  'w-full rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none'

const INTRO_SLIDES = [
  {
    image: personajePresentacion,
    title: 'La propuesta vive en Verde',
    text: 'Se elabora y se envía con el hotel en Verde — y de ahí no se avanza sin propuesta enviada.',
  },
  {
    image: personajePago,
    title: 'Tarifas globales, por ahora',
    text: 'Un pay rate y un bill rate para todo el hotel. Cotizar por posición llegará más adelante.',
  },
  {
    image: personajeRetro,
    title: 'Lo enviado no se edita',
    text: 'Cada envío congela una versión. Renegociar es abrir una nueva, que arranca con las tarifas de la anterior.',
  },
] as const

export function ProposalEditorPage({
  prospectId: prospectIdProp,
  embedded = false,
}: {
  /** Embebido en la lista de Propuestas (lista-detalle): el id llega por prop. */
  prospectId?: string
  embedded?: boolean
} = {}): ReactNode {
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
  /** Elaborar, enviar y descartar son del BD dueño (proposals:create/:send); el resto consulta. */
  const canEdit = can('proposals:create')

  const { register, handleSubmit, reset, trigger, formState } = useForm<ProposalDraftForm>({
    resolver: zodResolver(proposalDraftSchema),
    mode: 'onChange',
    defaultValues: { servicesNote: '', payRate: 0, billRate: 0 },
  })

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
      payRate: draft.payRate,
      billRate: draft.billRate,
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
          Este hotel no tiene propuesta o el enlace ya no sirve. Vuelve al Pipeline y ábrela desde
          su ficha.
        </p>
        <Link to="/pipeline" className="text-sm font-semibold text-o-700 hover:underline">
          Volver al Pipeline
        </Link>
      </div>
    )
  }

  function actionErrorMessage(error: unknown): string {
    return apiErrorMessage(error, {
      byCode: {
        PROPOSAL_STATE: `La propuesta se trabaja con el hotel en Verde o Café — este está en ${workspace ? ONBOARDING_STATUS_LABEL[workspace.prospectStatus] : 'otro estado'}.`,
        PROPOSAL_SENT: 'Esta versión ya se envió: lo enviado no se edita — abre una versión nueva.',
      },
      fallback: 'No se pudo guardar la propuesta. Revisa las tarifas e inténtalo de nuevo.',
    })
  }

  async function persist(values: ProposalDraftForm): Promise<void> {
    if (!draft) return
    setActionError(null)
    try {
      await saveDraft({ proposalId: draft.id, prospectId, ...values }).unwrap()
      toast.success('Borrador guardado')
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
      toast.success('Propuesta enviada al hotel')
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
      toast.success('Borrador descartado')
      void navigate(`/pipeline/${prospectId}`)
    } catch (error) {
      setDiscardArmed(false)
      setActionError(
        apiErrorMessage(error, {
          byCode: {
            PROPOSAL_NOT_DRAFT: 'Esta versión ya se envió: lo enviado no se descarta.',
          },
          fallback: 'No se pudo descartar el borrador. Inténtalo de nuevo.',
        }),
      )
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {!embedded && (
        <nav aria-label="Ruta" className="flex items-center gap-2 text-sm text-ink-3">
          <Link to="/pipeline" className="hover:text-o-700">
            Pipeline
          </Link>
          <span aria-hidden>›</span>
          <Link to={`/pipeline/${prospectId}`} className="hover:text-o-700">
            {workspace.hotelName}
          </Link>
          <span aria-hidden>›</span>
          <span className="text-ink-2">Propuesta</span>
        </nav>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              Propuesta · {workspace.hotelName}
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
                : `Versión ${draft.version} · borrador sin enviar`
              : 'Sin versión abierta · la última ya se envió'}
            {draft && lastSent && (
              <span className="text-ink-2">
                {' '}
                · el hotel tiene la v{lastSent.version} (enviada{' '}
                {lastSent.sentAt ? formatDate(lastSent.sentAt) : '—'})
              </span>
            )}
            {' · '}
            <button
              type="button"
              onClick={reopenIntro}
              className="cursor-pointer font-medium text-o-700 hover:underline"
            >
              ¿Cómo funciona?
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
                  toast('¿Seguro? Toca «Sí, descartar borrador» para confirmar.')
                  return
                }
                void discard()
              }}
            >
              {isDiscarding
                ? 'Descartando…'
                : isDiscardArmed
                  ? 'Sí, descartar borrador'
                  : 'Descartar borrador'}
            </Button>
            <Button type="submit" form={FORM_ID} disabled={!formState.isValid || isBusy}>
              {isSaving ? 'Guardando…' : 'Guardar borrador'}
            </Button>
            <Button
              variant="primary"
              disabled={!formState.isValid || isBusy}
              onClick={() => {
                void handleSubmit(persistAndSend)()
              }}
            >
              {isSending ? 'Enviando…' : 'Enviar propuesta'}
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
            slides={INTRO_SLIDES}
            startLabel="Ir a la propuesta"
            onDone={dismissIntro}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            {draft && !canEdit ? (
              /* Quien consulta ve VALORES, no un formulario: inputs con errores de validación parecían una captura pendiente. */
              <SectionCard title={`Borrador v${draft.version} · en elaboración`}>
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
                    Lo elabora <span className="font-semibold">{workspace.owner.name}</span> — el BD
                    dueño del ciclo.
                  </p>
                </div>
                <dl className="flex flex-col divide-y divide-line rounded-lg border border-line">
                  <div className="flex items-start justify-between gap-4 p-3">
                    <dt className="text-sm text-ink-3">Servicios ofrecidos</dt>
                    <dd className="text-right text-sm font-medium text-ink">
                      {draft.servicesNote || 'Aún sin describir'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 p-3">
                    <dt className="text-sm text-ink-3">Pay rate</dt>
                    <dd className="text-sm font-medium text-ink">${draft.payRate.toFixed(2)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 p-3">
                    <dt className="text-sm text-ink-3">Bill rate</dt>
                    <dd className="text-sm font-medium text-ink">${draft.billRate.toFixed(2)}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-sm leading-relaxed text-ink-3">
                  Es un borrador en elaboración: los valores pueden cambiar hasta que el BD la
                  envíe. Cuando la envíe, aquí verás la versión final.
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
                <SectionCard title="Servicios ofrecidos">
                  <FormField
                    label="Descripción"
                    htmlFor="servicesNote"
                    hint={
                      IS_DEV_UI
                        ? 'services_note — texto libre'
                        : 'Qué va a cubrir Oranje en este hotel'
                    }
                    error={formState.errors.servicesNote?.message}
                  >
                    <input
                      id="servicesNote"
                      type="text"
                      placeholder="Housekeeping y Steward para temporada alta…"
                      {...register('servicesNote')}
                      className={CONTROL_CLASS}
                    />
                  </FormField>
                </SectionCard>

                <SectionCard title="Tarifas tentativas">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <FormField
                      label="Pay rate"
                      htmlFor="payRate"
                      error={formState.errors.payRate?.message}
                    >
                      <MoneyInput id="payRate" {...register('payRate', { valueAsNumber: true })} />
                    </FormField>

                    <FormField
                      label="Bill rate"
                      htmlFor="billRate"
                      error={formState.errors.billRate?.message}
                    >
                      <MoneyInput
                        id="billRate"
                        {...register('billRate', { valueAsNumber: true })}
                      />
                    </FormField>
                  </div>

                  <p className="mt-5 rounded-md bg-o-50 p-4 text-sm leading-relaxed text-ink-2">
                    {IS_DEV_UI
                      ? 'Tarifas globales, no por posición. Cuando el negocio cotice Chef y Housekeeper por separado se agrega proposal_rate — migración aditiva, sin tocar esta pantalla.'
                      : 'Las tarifas aplican a todo el hotel, no por posición. Cotizar por posición llegará más adelante.'}
                  </p>
                </SectionCard>
              </form>
            ) : (
              <SectionCard
                title={lastSent ? `Última enviada · v${lastSent.version}` : 'Sin versión abierta'}
              >
                {/* Lo que la propuesta INCLUYE se ve aquí mismo, sea cual sea tu rol. */}
                {lastSent && (
                  <dl className="mb-4 flex flex-col divide-y divide-line rounded-lg border border-line">
                    <div className="flex items-start justify-between gap-4 p-3">
                      <dt className="text-sm text-ink-3">Servicios ofrecidos</dt>
                      <dd className="text-right text-sm font-medium text-ink">
                        {lastSent.servicesNote || '—'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 p-3">
                      <dt className="text-sm text-ink-3">Pay rate</dt>
                      <dd className="text-sm font-medium text-ink">
                        ${lastSent.payRate.toFixed(2)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 p-3">
                      <dt className="text-sm text-ink-3">Bill rate</dt>
                      <dd className="text-sm font-medium text-ink">
                        ${lastSent.billRate.toFixed(2)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 p-3">
                      <dt className="text-sm text-ink-3">Enviada</dt>
                      <dd className="text-sm font-medium text-ink">
                        {lastSent.sentAt ? formatDate(lastSent.sentAt) : '—'}
                        {lastSent.byName ? ` · por ${lastSent.byName}` : ''}
                      </dd>
                    </div>
                  </dl>
                )}
                <p className="text-sm leading-relaxed text-ink-3">
                  Las enviadas no se editan: para renegociar se abre una versión nueva, que arranca
                  con las tarifas de la anterior. El contrato de esta versión se abre desde el
                  historial.
                </p>
                {canEdit ? (
                  <>
                    <Button
                      variant="primary"
                      className="mt-5"
                      disabled={isBusy}
                      onClick={() => {
                        void createDraft(prospectId)
                          .unwrap()
                          .then(() => {
                            toast.success('Versión nueva abierta')
                          })
                          .catch(() => {})
                      }}
                    >
                      {isCreating ? 'Abriendo…' : 'Abrir versión nueva'}
                    </Button>
                    {hasCreateFailed && (
                      <p role="alert" className="mt-3 text-sm text-red">
                        No se pudo abrir la versión: solo el BD dueño del ciclo puede elaborar la
                        propuesta.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-5 rounded-md bg-o-50 px-4 py-3 text-sm text-o-700">
                    Solo el BD dueño del ciclo abre versiones nuevas. Desde tu rol puedes consultar
                    la propuesta, no editarla.
                  </p>
                )}
              </SectionCard>
            )}

            <ProposalVersionHistory
              hotelName={workspace.hotelName}
              hotelAddress={workspace.hotelAddress}
              versions={workspace.versions}
            />
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Campo de tarifa con el `$` delante. Se separa el símbolo del control porque
 * `type="number"` no admite texto dentro, y con `type="text"` se perdería el
 * teclado numérico del móvil y la validación del navegador.
 */
function MoneyInput({ id, ...props }: ComponentProps<'input'>): ReactNode {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm text-ink-3">
        $
      </span>
      <input
        id={id}
        type="number"
        step="0.01"
        min="0"
        {...props}
        className={cn(CONTROL_CLASS, 'pl-8')}
      />
    </div>
  )
}
