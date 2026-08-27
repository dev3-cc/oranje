import { zodResolver } from '@hookform/resolvers/zod'
import { cn, StatusLightBadge, toast } from '@oranje/ui'
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router'

import {
  useCreateProposalDraftMutation,
  useGetProposalWorkspaceQuery,
  useSaveProposalDraftMutation,
  useSendProposalMutation,
} from '../api/proposalsApi'
import { ProposalVersionHistory } from '../components/ProposalVersionHistory'
import { proposalDraftSchema, type ProposalDraftForm } from '../types/proposalDraft.schema'

import { useGetSessionQuery } from '@/app/sessionApi'
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
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { apiErrorMessage } from '@/shared/lib/apiError'

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
    text: 'Pay y bill generales para todo el hotel. Cotizar por posición llegará como cambio aditivo.',
  },
  {
    image: personajeRetro,
    title: 'Lo enviado no se edita',
    text: 'Cada envío congela una versión. Renegociar es abrir una nueva, que arranca con las tarifas de la anterior.',
  },
] as const

export function ProposalEditorPage(): ReactNode {
  const { prospectId = '' } = useParams()

  const {
    data: workspace,
    isLoading,
    isError,
  } = useGetProposalWorkspaceQuery(prospectId, { skip: prospectId === '' })

  const { data: session } = useGetSessionQuery()
  const [saveDraft, { isLoading: isSaving }] = useSaveProposalDraftMutation()
  const [sendProposal, { isLoading: isSending }] = useSendProposalMutation()
  /** El error del guardado/envío SE VE: tragárselo dejaba botones «muertos». */
  const [actionError, setActionError] = useState<string | null>(null)
  const [createDraft, { isLoading: isCreating, isError: hasCreateFailed }] =
    useCreateProposalDraftMutation()
  /** El intro de página se ve UNA vez; «¿Cómo funciona?» lo reabre. */
  const { isIntroOpen, dismissIntro, reopenIntro } = useIntroSeen('proposal-editor')
  const isBd = session?.roleId === 'ROL-V-01'

  const { register, handleSubmit, reset, trigger, formState } = useForm<ProposalDraftForm>({
    resolver: zodResolver(proposalDraftSchema),
    mode: 'onChange',
    defaultValues: { servicesNote: '', payRate: 0, billRate: 0 },
  })

  const draft = workspace?.draft ?? null

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
        <p className="text-sm text-red">No se encontró la propuesta de este hotel.</p>
        <Link to="/pipeline" className="text-sm font-semibold text-o-700 hover:underline">
          Volver al pipeline
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
      fallback: 'No se pudo guardar la propuesta. Inténtalo de nuevo.',
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

  const isBusy = isSaving || isSending || isCreating

  return (
    <div className="flex flex-col gap-6">
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
              ? `Versión ${draft.version} · borrador · sent_at es NULL hasta enviarla`
              : 'Sin versión abierta · la última ya se envió'}
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

        {draft && (
          <div className="flex items-center gap-3">
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
            {draft ? (
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
                    hint="services_note — texto libre"
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
                    Tarifas globales, no por posición. Cuando el negocio cotice Chef y Housekeeper
                    por separado se agrega proposal_rate — migración aditiva, sin tocar esta
                    pantalla.
                  </p>
                </SectionCard>
              </form>
            ) : (
              <SectionCard title="Sin versión abierta">
                <p className="text-sm leading-relaxed text-ink-3">
                  La última versión ya se envió. Las enviadas no se editan: para renegociar se abre
                  una versión nueva, que arranca con las tarifas de la anterior.
                </p>
                {isBd ? (
                  <>
                    <Button
                      variant="primary"
                      className="mt-5"
                      disabled={isBusy}
                      onClick={() => {
                        void createDraft(prospectId)
                      }}
                    >
                      {isCreating ? 'Abriendo…' : 'Nueva versión'}
                    </Button>
                    {hasCreateFailed && (
                      <p role="alert" className="mt-3 text-sm text-red">
                        No se pudo abrir la versión. Solo el Business Developer dueño del ciclo
                        puede elaborar la propuesta.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-5 rounded-md bg-o-50 px-4 py-3 text-sm text-o-700">
                    Abrir versiones es del Business Developer dueño del ciclo — tu rol consulta y
                    acompaña, pero la propuesta la elabora él.
                  </p>
                )}
              </SectionCard>
            )}

            <ProposalVersionHistory hotelName={workspace.hotelName} versions={workspace.versions} />
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
