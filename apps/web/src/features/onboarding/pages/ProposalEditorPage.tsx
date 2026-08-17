import { zodResolver } from '@hookform/resolvers/zod'
import { cn, SemaforoBadge } from '@oranje/ui'
import { useEffect, type ComponentProps, type ReactNode } from 'react'
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

import { Button } from '@/shared/components/Button'
import { FormField } from '@/shared/components/FormField'
import { SectionCard } from '@/shared/components/SectionCard'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'

const FORM_ID = 'proposal-draft'

const CONTROL_CLASS =
  'w-full rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none'

export function ProposalEditorPage(): ReactNode {
  const { prospectId = '' } = useParams()

  const {
    data: workspace,
    isLoading,
    isError,
  } = useGetProposalWorkspaceQuery(prospectId, { skip: prospectId === '' })

  const [saveDraft, { isLoading: isSaving }] = useSaveProposalDraftMutation()
  const [sendProposal, { isLoading: isSending }] = useSendProposalMutation()
  const [createDraft, { isLoading: isCreating }] = useCreateProposalDraftMutation()

  const { register, handleSubmit, reset, formState } = useForm<ProposalDraftForm>({
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
  }, [draft, reset])

  if (isLoading) return <p className="text-sm text-ink-3">Cargando propuesta…</p>

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

  async function persist(values: ProposalDraftForm): Promise<void> {
    if (!draft) return
    await saveDraft({ proposalId: draft.id, prospectId, ...values }).unwrap()
  }

  /** Enviar guarda primero: si no, se enviaría la versión sin los cambios en pantalla. */
  async function persistAndSend(values: ProposalDraftForm): Promise<void> {
    if (!draft) return
    await persist(values)
    await sendProposal({ proposalId: draft.id, prospectId }).unwrap()
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
            <SemaforoBadge
              token={ONBOARDING_STATUS_TOKEN[workspace.prospectStatus]}
              label={ONBOARDING_STATUS_LABEL[workspace.prospectStatus]}
            />
          </div>
          <p className="mt-1.5 text-sm text-ink-3">
            {draft
              ? `Versión ${draft.version} · borrador · sent_at es NULL hasta enviarla`
              : 'Sin versión abierta · la última ya se envió'}
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

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {draft ? (
          <form
            id={FORM_ID}
            noValidate
            onSubmit={(event) => {
              void handleSubmit(persist)(event)
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
                  <MoneyInput id="billRate" {...register('billRate', { valueAsNumber: true })} />
                </FormField>
              </div>

              <p className="mt-5 rounded-md bg-o-50 p-4 text-sm leading-relaxed text-ink-2">
                Tarifas globales, no por posición. Cuando el negocio cotice Chef y Housekeeper por
                separado se agrega proposal_rate — migración aditiva, sin tocar esta pantalla.
              </p>
            </SectionCard>
          </form>
        ) : (
          <SectionCard title="Sin versión abierta">
            <p className="text-sm leading-relaxed text-ink-3">
              La última versión ya se envió. Las enviadas no se editan: para renegociar se abre una
              versión nueva, que arranca con las tarifas de la anterior.
            </p>
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
          </SectionCard>
        )}

        <ProposalVersionHistory hotelName={workspace.hotelName} versions={workspace.versions} />
      </div>
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
