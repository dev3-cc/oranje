import { zodResolver } from '@hookform/resolvers/zod'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  MaterialIcon,
  StatusLightBadge,
  toast,
} from '@oranje/ui'
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'

import { useDiscardProposalDraftMutation } from '../api/onboardingApi'
import {
  useCreateProposalDraftMutation,
  useGetProposalWorkspaceQuery,
  useSaveProposalDraftMutation,
  useSendProposalEmailMutation,
  useSendProposalMutation,
} from '../api/proposalsApi'
import { ConfirmSendProposalDialog } from '../components/ConfirmSendProposalDialog'
import { ProposalRateFields } from '../components/ProposalRateFields'
import { ProposalVersionHistory } from '../components/ProposalVersionHistory'
import { buildProposalDraftSchema, type ProposalDraftForm } from '../types/proposalDraft.schema'

import { useGetSessionQuery } from '@/app/sessionApi'
import personajeEstrategia from '@/assets/ilustrations/personaje-estrategia.svg'
import personajePago from '@/assets/ilustrations/personaje-pago-procesado.svg'
import personajePresentacion from '@/assets/ilustrations/personaje-presentacion.svg'
import personajeRetro from '@/assets/ilustrations/personaje-retroalimentacion.svg'
import { BlockedAction, BlockedReasons } from '@/shared/components/BlockedAction'
import { Button } from '@/shared/components/Button'
import { DetailSkeleton } from '@/shared/components/DetailSkeleton'
import { FormField } from '@/shared/components/FormField'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { PhoneInput } from '@/shared/components/PhoneInput'
import { ProposalDocument } from '@/shared/components/ProposalDocument'
import { SectionCard } from '@/shared/components/SectionCard'
import { SendDocumentModal } from '@/shared/components/SendDocumentModal'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { useCan } from '@/shared/hooks/useCan'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDate } from '@/shared/lib/formatters'
import { MOTION } from '@/shared/lib/motion'
import {
  downloadProposalDocx,
  downloadProposalPdf,
  preparedDateUs,
  proposalPdfBlob,
  type ProposalDocumentInput,
} from '@/shared/lib/proposalDocument'

/** Donde la propuesta se elabora y envía: Verde (RR-V) y Café (renegociación). */
const WORKABLE_STATUSES = new Set(['GREEN', 'BROWN'])
/** Naranja, EXCEPCIÓN: solo si el hotel se quedó sin contrato vigente
    (Hugo, 2026-10-16) — ver `hasActiveContract` en el workspace. */
const ORANGE = 'ORANGE'

const FORM_ID = 'proposal-draft'

/** El de Irene en el machote aprobado: lo que hoy es cierto para Oranje, editable por si cambia. */
const DEFAULT_SENDER_PHONE = '404-790-2517'

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
  const reduceMotion = useReducedMotion() ?? false

  /*
   * `currentData`, no `data`: al cambiar de propuesta en la lista, `data` se
   * queda con la anterior mientras llega la nueva y la pantalla mentiría un
   * instante — se sentía «pegada» (Hugo, 2026-10-20). Con `currentData` se
   * vacía y aparece el skeleton, mismo criterio que ya usa `ContractDetailPage`.
   */
  const {
    currentData: workspace,
    isFetching,
    isError,
  } = useGetProposalWorkspaceQuery(prospectId, { skip: prospectId === '' })
  const { data: session } = useGetSessionQuery()

  const [saveDraft, { isLoading: isSaving }] = useSaveProposalDraftMutation()
  const [sendProposalEmail, { isLoading: isSendingEmail }] = useSendProposalEmailMutation()
  const [sendProposal, { isLoading: isMarkingSent }] = useSendProposalMutation()
  /** El error del guardado/envío SE VE: tragárselo dejaba botones «muertos». */
  const [actionError, setActionError] = useState<string | null>(null)
  /* Paso previo a CUALQUIER camino que deja la propuesta en Enviada — por
     correo o marcada a mano — porque las dos cierran la versión para
     siempre (Hugo, 2026-10-19). */
  const [confirmSendMode, setConfirmSendMode] = useState<'email' | 'mark' | null>(null)
  const [createDraft, { isLoading: isCreating, isError: hasCreateFailed, error: createError }] =
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
  const isWorkable =
    workspace === undefined ||
    WORKABLE_STATUSES.has(workspace.prospectStatus) ||
    (workspace.prospectStatus === ORANGE && !workspace.hasActiveContract)
  const workableBlock =
    !isWorkable && workspace
      ? t`La propuesta se trabaja con el hotel en Verde o Café: este está en ${ONBOARDING_STATUS_LABEL[workspace.prospectStatus]}`
      : null

  /* El modal de envío: el PDF se genera ANTES de abrirlo (de lo que ya se
     guardó), así que «Enviar correo» solo sube lo que ya se armó. */
  const [isSendModalOpen, setSendModalOpen] = useState(false)
  const [pendingPdf, setPendingPdf] = useState<Blob | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  /* Los mensajes del esquema se resuelven al armarlo, así que se rearma al
     cambiar de idioma: `i18n` no cambia de identidad al activar otro (D-36). */
  const schema = useMemo(() => buildProposalDraftSchema(i18n), [i18n, i18n.locale])

  const { register, control, handleSubmit, reset, trigger, watch, formState } =
    useForm<ProposalDraftForm>({
      resolver: zodResolver(schema),
      mode: 'onChange',
      defaultValues: {
        propertyName: '',
        preparedDate: '',
        brandManagementCompany: '',
        cityState: '',
        contactName: '',
        senderPhone: DEFAULT_SENDER_PHONE,
        senderEmail: '',
        rates: [],
      },
    })

  const draft = workspace?.draft ?? null
  /** La última ENVIADA: lo que se enseña cuando no hay borrador abierto. */
  const lastSent =
    workspace?.versions
      .filter((version) => version.sentAt !== null)
      .sort((a, b) => b.version - a.version)[0] ?? null

  const watchedValues = watch()

  /* Por qué Guardar/Enviar están apagados (Hugo, 2026-10-23): «ya llené los
     campos y no me deja enviar» — faltaba el cuadro de tarifas, más abajo, y
     el error de un campo solo sale al tocarlo. Se valida lo que hay en
     pantalla con el mismo esquema y se dice en voz alta. El back también
     rechaza guardar y enviar fuera de Verde/Café, así que eso va en la lista. */
  const parsedDraft = schema.safeParse(watchedValues)
  const draftBlockers = [
    ...new Set([
      ...(workableBlock ? [workableBlock] : []),
      ...(parsedDraft.success
        ? []
        : parsedDraft.error.issues.map((issue) =>
            /* Una tarifa vacía llega como NaN y Zod la reporta en inglés. */
            issue.path[0] === 'rates' && issue.code === 'invalid_type'
              ? issue.path[2] === 'billRate'
                ? t`Falta el bill rate de un puesto`
                : t`Falta el pay rate de un puesto`
              : issue.message,
          )),
    ]),
  ]
  const isDraftBlocked = !formState.isValid || !isWorkable

  /* La vista previa del documento vive del formulario mientras se edita, y de
     la última versión enviada cuando no hay borrador — nunca de un fetch
     aparte: es literalmente lo que ya está en pantalla. */
  const documentInput: ProposalDocumentInput | null = !workspace
    ? null
    : draft
      ? {
          hotelName: workspace.hotelName,
          senderName: workspace.owner.name,
          propertyName: watchedValues.propertyName || null,
          preparedDate: watchedValues.preparedDate || null,
          brandManagementCompany: watchedValues.brandManagementCompany || null,
          cityState: watchedValues.cityState || null,
          contactName: watchedValues.contactName || null,
          senderPhone: watchedValues.senderPhone || null,
          senderEmail: watchedValues.senderEmail || null,
          rates: (watchedValues.rates ?? [])
            .filter((rate) => rate.positionId !== '')
            .map((rate) => ({
              key: rate.positionId,
              positionName:
                workspace.positions.find((position) => position.id === rate.positionId)?.name ??
                rate.positionId,
              billRate: rate.billRate,
            })),
        }
      : lastSent
        ? {
            hotelName: workspace.hotelName,
            senderName: workspace.owner.name,
            propertyName: lastSent.propertyName || null,
            preparedDate: lastSent.preparedDate || null,
            brandManagementCompany: lastSent.brandManagementCompany || null,
            cityState: lastSent.cityState || null,
            contactName: lastSent.contactName || null,
            senderPhone: lastSent.senderPhone || null,
            senderEmail: lastSent.senderEmail || null,
            rates: lastSent.rates.map((rate) => ({
              key: rate.positionId,
              positionName: rate.positionName,
              billRate: rate.billRate,
            })),
          }
        : null

  const hasQuotedRates = (documentInput?.rates.length ?? 0) > 0

  // El formulario se rellena cuando llega el borrador, y al cambiar de versión.
  useEffect(() => {
    if (!draft || !workspace) return
    reset({
      /* Lo que ya tenemos se prellena para ahorrar tecleo (Hugo, 2026-10-19);
         lo que no existe en ningún lado queda vacío, nunca inventado. */
      propertyName: draft.propertyName || workspace.hotelName,
      /* A diferencia de los demás, su "ya lo tenemos" no es un dato del
         workspace sino la fecha de hoy: nunca se inventa con datos viejos. */
      preparedDate: draft.preparedDate || preparedDateUs(),
      brandManagementCompany: draft.brandManagementCompany,
      cityState: draft.cityState || workspace.hotelAddress || '',
      contactName: draft.contactName || workspace.contactName || '',
      senderPhone: draft.senderPhone || DEFAULT_SENDER_PHONE,
      senderEmail: draft.senderEmail || session?.email || '',
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
    /* `workspace`/`session` se LEEN para el prellenado al llegar ESTE borrador,
       pero no van en las deps a propósito: listarlos reiniciaría el formulario
       (perdiendo lo que el BD ya tecleó) cada vez que cualquiera de los dos se
       vuelve a pedir por su propio ciclo de vida (foco, invalidación). */
  }, [draft, reset, trigger])

  if (isFetching && !workspace) return <DetailSkeleton />

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

  /** `silent`: cuando guardar es un PASO previo a enviar/marcar como enviada,
      no al botón "Guardar borrador" — "Borrador guardado" ahí confunde, el
      usuario pidió enviar, no guardar (Hugo, 2026-10-20). */
  async function persist(values: ProposalDraftForm, { silent = false } = {}): Promise<void> {
    if (!draft) return
    setActionError(null)
    try {
      await saveDraft({
        proposalId: draft.id,
        prospectId,
        ...values,
        /* El único campo opcional del machote (Hugo, 2026-10-19): el resto ya
           viene como string por el schema. */
        brandManagementCompany: values.brandManagementCompany ?? '',
      }).unwrap()
      if (!silent) toast.success(t`Borrador guardado`)
    } catch (error) {
      setActionError(actionErrorMessage(error))
      throw error
    }
  }

  /** Guarda y arma el PDF ANTES de abrir el modal: lo que se adjunta es lo que
      se acaba de guardar, no lo que había cuando se abrió la pantalla. */
  async function openSendModal(values: ProposalDraftForm): Promise<void> {
    if (!draft || !documentInput) return
    try {
      await persist(values, { silent: true })
      const blob = await proposalPdfBlob(documentInput)
      setPendingPdf(blob)
      setSendError(null)
      setSendModalOpen(true)
    } catch (error) {
      setActionError(actionErrorMessage(error))
    }
  }

  async function confirmSend({ to, note }: { to: string; note: string }): Promise<void> {
    if (!draft || !pendingPdf) return
    try {
      const result = await sendProposalEmail({
        proposalId: draft.id,
        prospectId,
        to,
        note,
        pdf: pendingPdf,
      }).unwrap()
      setSendModalOpen(false)
      setPendingPdf(null)
      toast.success(
        result.email.status === 'SENT'
          ? t`Propuesta enviada al hotel`
          : t`La propuesta quedó enviada — el correo no salió, mándalo aparte.`,
      )
    } catch (error) {
      setSendError(actionErrorMessage(error))
    }
  }

  /** El OK del modal de advertencia: según por dónde entró, arma el correo o
      congela la versión directo, sin mandar nada. */
  async function handleConfirmSendMode(): Promise<void> {
    if (confirmSendMode === 'mark') {
      /* Igual que el correo (`openSendModal`): se guarda lo editado ANTES de
         congelar la versión — "marcar como enviada" no es solo un cambio de
         status, es el último estado del documento (Hugo, 2026-10-19). */
      await handleSubmit(async (values) => {
        if (!draft) return
        try {
          await persist(values, { silent: true })
          await sendProposal({ proposalId: draft.id, prospectId }).unwrap()
          setConfirmSendMode(null)
          toast.success(t`Propuesta marcada como enviada`)
        } catch (error) {
          setActionError(actionErrorMessage(error))
        }
      })()
      return
    }

    setConfirmSendMode(null)
    await handleSubmit(openSendModal)()
  }

  const isBusy = isSaving || isSendingEmail || isMarkingSent || isCreating || isDiscarding

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
        <div className="flex items-center gap-2">
          {/* Sin flecha propia: `AppShell` ya pinta una global para toda
              sub-vista (mismo criterio que `ProspectDetailPage`) — con las
              dos juntas se veía doble. */}
          <nav aria-label="Ruta" className="flex items-center gap-2 text-sm text-ink-3">
            <Link to="/proposals" className="hover:text-o-700">
              <Trans>Propuestas</Trans>
            </Link>
            <span aria-hidden>›</span>
            <Link to={`/pipeline/${prospectId}`} className="hover:text-o-700">
              {workspace.hotelName}
            </Link>
          </nav>
        </div>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              {t`Propuesta · ${workspace.hotelName}`}
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

        <div className="flex items-center gap-3">
          {documentInput && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  disabled={!hasQuotedRates}
                  title={!hasQuotedRates ? t`Cotiza al menos un puesto para descargar` : undefined}
                >
                  <MaterialIcon name="download" className="text-base" aria-hidden />
                  <Trans>Descargar</Trans>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    void downloadProposalPdf(documentInput)
                  }}
                >
                  <MaterialIcon name="picture_as_pdf" className="text-base" aria-hidden />
                  <Trans>Descargar PDF</Trans>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    void downloadProposalDocx(documentInput)
                  }}
                >
                  <MaterialIcon name="description" className="text-base" aria-hidden />
                  <Trans>Descargar Word</Trans>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {draft && canEdit && (
            <>
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
              <BlockedAction
                reasons={isDraftBlocked ? draftBlockers : []}
                title={t`Antes de guardar:`}
              >
                <Button type="submit" form={FORM_ID} disabled={isDraftBlocked || isBusy}>
                  {isSaving ? <Trans>Guardando…</Trans> : <Trans>Guardar borrador</Trans>}
                </Button>
              </BlockedAction>
              <DropdownMenu>
                <BlockedAction
                  reasons={isDraftBlocked ? draftBlockers : []}
                  title={t`Antes de enviar:`}
                >
                  <DropdownMenuTrigger asChild>
                    <Button variant="primary" disabled={isDraftBlocked || isBusy}>
                      <Trans>Enviar propuesta</Trans>
                      <MaterialIcon name="expand_more" className="text-base" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                </BlockedAction>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      setConfirmSendMode('email')
                    }}
                  >
                    <MaterialIcon name="mail" className="text-base" aria-hidden />
                    <Trans>Enviar por correo</Trans>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setConfirmSendMode('mark')
                    }}
                  >
                    <MaterialIcon name="task_alt" className="text-base" aria-hidden />
                    <Trans>Marcar como enviada</Trans>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </header>

      {draft && canEdit && isDraftBlocked && (
        <BlockedReasons reasons={draftBlockers} title={t`Antes de guardar o enviar:`} />
      )}

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
        <motion.div
          key={draft?.id ?? lastSent?.id ?? 'sin-version'}
          initial={{ opacity: 0, x: reduceMotion ? 0 : 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reduceMotion ? 0 : MOTION.enter, ease: [...MOTION.easeOut] }}
          className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        >
          <div className="flex flex-col gap-5">
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
                <SectionCard title={t`Información general`}>
                  <div className="flex flex-col gap-5">
                    <FormField
                      label={t`Nombre de la propiedad`}
                      htmlFor="propertyName"
                      hint={t`El [PROPERTY NAME] del machote — ya viene del hotel, cámbialo si el documento debe usar otro nombre`}
                      error={formState.errors.propertyName?.message}
                    >
                      <input
                        id="propertyName"
                        type="text"
                        maxLength={200}
                        placeholder={t`Nombre del hotel en el documento`}
                        {...register('propertyName')}
                        className={CONTROL_CLASS}
                      />
                    </FormField>

                    <FormField
                      label={t`Fecha de preparación`}
                      htmlFor="preparedDate"
                      hint={t`El "Prepared [DATE]" del machote — se prellena con hoy, cámbiala si el documento debe llevar otra fecha`}
                      error={formState.errors.preparedDate?.message}
                    >
                      <input
                        id="preparedDate"
                        type="text"
                        maxLength={40}
                        placeholder={t`Ej. 10/19/2026`}
                        {...register('preparedDate')}
                        className={CONTROL_CLASS}
                      />
                    </FormField>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <FormField
                        label={t`Marca / Administradora`}
                        htmlFor="brandManagementCompany"
                        hint={t`Opcional — solo si el hotel pertenece a una cadena o lo administra otra empresa`}
                        error={formState.errors.brandManagementCompany?.message}
                      >
                        <input
                          id="brandManagementCompany"
                          type="text"
                          maxLength={200}
                          placeholder={t`Ej. Marriott International`}
                          {...register('brandManagementCompany')}
                          className={CONTROL_CLASS}
                        />
                      </FormField>

                      <FormField
                        label={t`Ciudad y estado`}
                        htmlFor="cityState"
                        error={formState.errors.cityState?.message}
                      >
                        <input
                          id="cityState"
                          type="text"
                          maxLength={200}
                          placeholder={t`Ej. Atlanta, GA`}
                          {...register('cityState')}
                          className={CONTROL_CLASS}
                        />
                      </FormField>
                    </div>

                    <FormField
                      label={t`Dirigida a`}
                      htmlFor="contactName"
                      hint={t`El "Dear [nombre]," de la carta — ya viene del contacto principal del hotel, cámbialo si va dirigida a alguien más`}
                      error={formState.errors.contactName?.message}
                    >
                      <input
                        id="contactName"
                        type="text"
                        maxLength={200}
                        placeholder={t`Nombre del contacto`}
                        {...register('contactName')}
                        className={CONTROL_CLASS}
                      />
                    </FormField>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <FormField
                        label={t`Teléfono de quien envía`}
                        error={formState.errors.senderPhone?.message}
                      >
                        <Controller
                          control={control}
                          name="senderPhone"
                          render={({ field }) => (
                            <PhoneInput
                              value={field.value}
                              onChange={field.onChange}
                              ariaLabel={t`Teléfono de quien envía`}
                            />
                          )}
                        />
                      </FormField>

                      <FormField
                        label={t`Correo de quien envía`}
                        htmlFor="senderEmail"
                        error={formState.errors.senderEmail?.message}
                      >
                        <input
                          id="senderEmail"
                          type="email"
                          maxLength={200}
                          placeholder={t`nombre@oranjepeople.com`}
                          {...register('senderEmail')}
                          className={CONTROL_CLASS}
                        />
                      </FormField>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title={t`Puestos cotizados`}>
                  <ProposalRateFields
                    control={control}
                    register={register}
                    industries={workspace.industries}
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
                    arranca con el título y las tarifas de la anterior.
                  </Trans>
                </p>
                {canEdit ? (
                  <>
                    <div className="mt-5">
                      <BlockedAction
                        reasons={workableBlock ? [workableBlock] : []}
                        title={t`Todavía no se puede:`}
                      >
                        <Button
                          variant="primary"
                          disabled={isBusy || !isWorkable}
                          onClick={() => {
                            void createDraft(prospectId)
                              .unwrap()
                              .then(() => {
                                toast.success(t`Versión nueva abierta`)
                              })
                              .catch(() => {})
                          }}
                        >
                          {isCreating ? (
                            <Trans>Abriendo…</Trans>
                          ) : (
                            <Trans>Abrir versión nueva</Trans>
                          )}
                        </Button>
                      </BlockedAction>
                    </div>
                    {hasCreateFailed && (
                      <p role="alert" className="mt-3 text-sm text-red">
                        {apiErrorMessage(createError, {
                          /* Por status y no por código: es el 403 genérico del
                             guard de permisos (`Tu rol no puede…`), que
                             `apiErrorMessage` traduciría a un texto sin
                             nombrar a nadie — aquí sí sabemos quién. El caso
                             más común, `PROPOSAL_DRAFT_EXISTS`, ya trae un
                             mensaje humano del back (con la versión exacta)
                             y llega solo, sin necesitar mapeo. */
                          byStatus: {
                            403: t`Solo el BD dueño del ciclo o el BDC pueden elaborar la propuesta.`,
                          },
                          fallback: t`No se pudo abrir la versión. Inténtalo de nuevo.`,
                        })}
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
              versions={workspace.versions}
            />
          </div>

          <SectionCard title={t`Vista previa del documento`}>
            <p className="-mt-2 mb-4 text-xs text-ink-3">
              <Trans>Se genera automáticamente a partir de los campos — no se edita aquí.</Trans>
            </p>
            {documentInput ? (
              <div className="rounded-md border border-line bg-surface px-6 py-6">
                <ProposalDocument {...documentInput} />
              </div>
            ) : (
              <p className="text-sm text-ink-3">
                <Trans>Sin propuesta que mostrar todavía.</Trans>
              </p>
            )}
          </SectionCard>
        </motion.div>
      )}

      <SendDocumentModal
        isOpen={isSendModalOpen}
        onClose={() => {
          setSendModalOpen(false)
          setSendError(null)
        }}
        title={t`Enviar propuesta por correo`}
        defaultTo={workspace.contactEmail}
        isSending={isSendingEmail}
        error={sendError}
        onConfirm={(params) => {
          void confirmSend(params)
        }}
      />

      {confirmSendMode && (
        <ConfirmSendProposalDialog
          isOpen
          onClose={() => {
            setConfirmSendMode(null)
          }}
          onConfirm={() => {
            void handleConfirmSendMode()
          }}
          /* "mark" ahora guarda (isSaving) antes de marcar (isMarkingSent): el
             modal debe seguir ocupado durante las dos, no solo la segunda. */
          isConfirming={isSaving || isMarkingSent}
          mode={confirmSendMode}
        />
      )}
    </div>
  )
}
