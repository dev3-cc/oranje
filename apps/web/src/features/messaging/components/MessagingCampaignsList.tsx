import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { cn, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import type { CampaignStatus } from '../api/messagingApi'
import {
  useGetMessagingCampaignsQuery,
  useRunMessagingCampaignActionMutation,
  type CampaignAction,
  type MessagingCampaign,
} from '../api/messagingCampaignsApi'

import { NewCampaignButton } from './CreateCampaignDialog'
import { ExcludedWorkersLink } from './ExcludedWorkersDialog'
import { ANY_FILTER, MessagingFilters } from './MessagingFilters'
import { SyncWorkersButton } from './SyncWorkersButton'
import { useWorkersSyncPending, WorkersSyncNotice } from './WorkersSyncNotice'

import personajeConfiguracion from '@/assets/ilustrations/personaje-configuracion.svg'
import personajeSinResultados from '@/assets/ilustrations/personaje-sin-resultados.svg'
import { Button } from '@/shared/components/Button'
import { LoadError } from '@/shared/components/LoadError'
import { Modal } from '@/shared/components/Modal'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatDateTime } from '@/shared/lib/formatters'

/* Los mismos colores que las últimas campañas del Panel. */
const STATUS: Record<CampaignStatus, { label: MessageDescriptor; className: string }> = {
  DRAFT: { label: msg`Borrador`, className: 'bg-surface-2 text-ink-3' },
  SCHEDULED: { label: msg`Programada`, className: 'bg-st-azul-claro/15 text-ink-2' },
  SENDING: { label: msg`Enviando`, className: 'bg-o-50 text-o-700' },
  COMPLETED: { label: msg`Completada`, className: 'bg-st-verde/15 text-st-verde' },
  PAUSED: { label: msg`Pausada`, className: 'bg-st-amarillo/20 text-ink-2' },
  FAILED: { label: msg`Falló`, className: 'bg-st-rojo/10 text-st-rojo' },
  CANCELLED: { label: msg`Cancelada`, className: 'bg-surface-2 text-ink-3' },
}

/**
 * Qué se puede hacer en cada estado, con las mismas reglas que la plataforma:
 * si aun así no se puede, ella responde con su mensaje.
 */
function actionsFor(status: CampaignStatus): CampaignAction[] {
  switch (status) {
    case 'DRAFT':
    case 'SCHEDULED':
      return ['send', 'cancel']
    case 'SENDING':
      return ['pause', 'cancel']
    case 'PAUSED':
      return ['resume', 'cancel']
    case 'FAILED':
      return ['cancel']
    default:
      return []
  }
}

const ACTION_LABEL: Record<CampaignAction, MessageDescriptor> = {
  send: msg`Enviar`,
  pause: msg`Pausar`,
  resume: msg`Reanudar`,
  cancel: msg`Cancelar`,
}

/**
 * Las campañas de la plataforma de mensajería: estado, avance del envío y las
 * acciones que permite cada estado (Hugo, 2026-10-23: fase 1, sin crear
 * campañas todavía). Enviar y cancelar piden confirmación: enviar manda
 * WhatsApp de verdad, y cancelar no se deshace.
 */
export function MessagingCampaignsList(): ReactNode {
  const { i18n } = useLingui()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState(ANY_FILTER)
  /* Colaboradores nuevos sin sincronizar: bloquean «Nueva campaña». */
  const pendingWorkers = useWorkersSyncPending()
  const { data, isLoading, isFetching, isError, error, refetch } = useGetMessagingCampaignsQuery({
    page,
    status: status === ANY_FILTER ? '' : (status as CampaignStatus),
  })

  if (isError) {
    return (
      <LoadError
        message={apiErrorMessage(error, {
          fallback: i18n._(msg`No se pudieron cargar las campañas.`),
        })}
        onRetry={(): void => void refetch()}
      />
    )
  }

  if (data?.configured === false) {
    return (
      <NoticeCard
        tone="warning"
        image={personajeConfiguracion}
        title={i18n._(msg`Este ambiente no está conectado a la plataforma de mensajería`)}
      >
        <Trans>
          Faltan las variables MESSAGING_API_* en el API. Cuando se configuren, aquí aparecen las
          campañas.
        </Trans>
      </NoticeCard>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">
            <Trans>Campañas</Trans>
          </h2>
          <p className="text-sm text-ink-3">
            {data?.configured === true ? (
              <Trans>{data.pagination.total} en total</Trans>
            ) : (
              <Trans>Envíos masivos por WhatsApp</Trans>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SyncWorkersButton highlight={pendingWorkers > 0} />
          <NewCampaignButton pendingWorkers={pendingWorkers} />
        </div>
      </div>

      <WorkersSyncNotice pending={pendingWorkers} />
      <ExcludedWorkersLink />

      <MessagingFilters
        status={{
          value: status,
          options: (Object.keys(STATUS) as CampaignStatus[]).map((value) => ({
            value,
            label: i18n._(STATUS[value].label),
          })),
          onChange: (value) => {
            setStatus(value)
            setPage(1)
          },
        }}
      />

      {isLoading || data?.configured !== true ? (
        <div className="h-64 animate-pulse rounded-lg bg-surface-3" />
      ) : data.campaigns.length === 0 ? (
        <NoticeCard
          image={personajeSinResultados}
          title={status === ANY_FILTER ? i18n._(msg`Sin campañas`) : i18n._(msg`Nadie coincide`)}
        >
          {status === ANY_FILTER ? (
            <Trans>Todavía no hay campañas en la plataforma.</Trans>
          ) : (
            <Trans>Ninguna campaña está en ese estado.</Trans>
          )}
        </NoticeCard>
      ) : (
        <>
          <CampaignsTable rows={data.campaigns} dimmed={isFetching} />
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm text-ink-3">
              <Button
                variant="secondary"
                disabled={page <= 1 || isFetching}
                onClick={() => {
                  setPage(page - 1)
                }}
              >
                <Trans>Anterior</Trans>
              </Button>
              <span>
                <Trans>
                  Página {data.pagination.page} de {data.pagination.totalPages}
                </Trans>
              </span>
              <Button
                variant="secondary"
                disabled={page >= data.pagination.totalPages || isFetching}
                onClick={() => {
                  setPage(page + 1)
                }}
              >
                <Trans>Siguiente</Trans>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function CampaignsTable({
  rows,
  dimmed,
}: {
  rows: MessagingCampaign[]
  dimmed: boolean
}): ReactNode {
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-lg border border-line bg-surface transition-opacity',
        dimmed && 'opacity-60',
      )}
    >
      <table className="w-full min-w-[48rem] text-sm">
        <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-3">
          <tr>
            <th className="px-4 py-3 font-semibold">
              <Trans>Campaña</Trans>
            </th>
            <th className="px-4 py-3 font-semibold">
              <Trans>Estado</Trans>
            </th>
            <th className="px-4 py-3 font-semibold">
              <Trans>Avance</Trans>
            </th>
            <th className="px-4 py-3 font-semibold">
              <Trans>Creada</Trans>
            </th>
            <th className="px-4 py-3 text-right font-semibold">
              <Trans>Acciones</Trans>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((campaign) => (
            <CampaignRow key={campaign.id} campaign={campaign} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CampaignRow({ campaign }: { campaign: MessagingCampaign }): ReactNode {
  const { i18n } = useLingui()
  /* La plataforma es de otro equipo: un estado nuevo se muestra tal cual. */
  const status = STATUS[campaign.status] as (typeof STATUS)[CampaignStatus] | undefined

  return (
    <tr>
      <td className="px-4 py-3">
        <p className="font-medium text-ink">{campaign.name}</p>
        <p className="text-xs text-ink-3">
          {campaign.templateName ?? <Trans>Sin plantilla</Trans>}
        </p>
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
            status?.className ?? 'bg-surface-2 text-ink-3',
          )}
        >
          {status ? i18n._(status.label) : campaign.status}
        </span>
      </td>
      <td className="px-4 py-3">
        <CampaignProgress campaign={campaign} />
      </td>
      <td className="px-4 py-3 text-ink-2">{formatDateTime(campaign.createdAt)}</td>
      <td className="px-4 py-3">
        <CampaignActions campaign={campaign} />
      </td>
    </tr>
  )
}

/** Enviados sobre el total en la barra; debajo, qué pasó con lo enviado. */
function CampaignProgress({ campaign }: { campaign: MessagingCampaign }): ReactNode {
  const { i18n } = useLingui()
  const { sentCount, totalRecipients } = campaign
  const percent = totalRecipients === 0 ? 0 : Math.round((sentCount / totalRecipients) * 100)

  return (
    <div className="flex min-w-48 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-ink-2 tabular-nums">
          <Trans>
            {sentCount} de {totalRecipients} enviados
          </Trans>
        </span>
        <span className="text-ink-3 tabular-nums">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={i18n._(msg`Avance del envío`)}
        className="h-1.5 overflow-hidden rounded-full bg-surface-3"
      >
        <div className="h-full rounded-full bg-o-500" style={{ width: `${String(percent)}%` }} />
      </div>
      <p className="text-xs text-ink-3 tabular-nums">
        <Trans>
          {campaign.deliveredCount} entregados · {campaign.readCount} leídos ·{' '}
          {campaign.failedCount} fallidos
        </Trans>
      </p>
    </div>
  )
}

function CampaignActions({ campaign }: { campaign: MessagingCampaign }): ReactNode {
  const { i18n } = useLingui()
  const [confirming, setConfirming] = useState<'send' | 'cancel' | null>(null)
  const [runAction, { isLoading }] = useRunMessagingCampaignActionMutation()
  const actions = actionsFor(campaign.status)
  const close = (): void => {
    setConfirming(null)
  }

  const run = async (action: CampaignAction): Promise<void> => {
    const done: Record<CampaignAction, MessageDescriptor> = {
      send: msg`«${campaign.name}» se está enviando.`,
      pause: msg`«${campaign.name}» quedó en pausa.`,
      resume: msg`«${campaign.name}» se reanudó.`,
      cancel: msg`«${campaign.name}» se canceló.`,
    }
    try {
      await runAction({ id: campaign.id, action }).unwrap()
      toast.success(i18n._(done[action]))
      close()
    } catch (error) {
      toast.error(
        apiErrorMessage(error, { fallback: i18n._(msg`No se pudo completar la acción.`) }),
      )
    }
  }

  if (actions.length === 0) return <p className="text-right text-ink-3">—</p>

  return (
    <div className="flex flex-wrap justify-end gap-1">
      {actions.map((action) => (
        <button
          key={action}
          type="button"
          disabled={isLoading}
          onClick={() => {
            if (action === 'send' || action === 'cancel') setConfirming(action)
            else void run(action)
          }}
          className={cn(
            'cursor-pointer rounded-md px-2 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            action === 'cancel' ? 'text-st-rojo hover:bg-st-rojo/10' : 'text-o-700 hover:bg-o-50',
          )}
        >
          {i18n._(ACTION_LABEL[action])}
        </button>
      ))}

      <Modal
        isOpen={confirming === 'send'}
        onClose={close}
        title={i18n._(msg`¿Enviar «${campaign.name}»?`)}
        description={i18n._(
          msg`Se manda por WhatsApp a ${campaign.totalRecipients} contactos con la plantilla ${campaign.templateName ?? '—'}. Una vez enviado, el mensaje no se puede retirar.`,
        )}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              <Trans>Volver</Trans>
            </Button>
            <Button variant="primary" disabled={isLoading} onClick={() => void run('send')}>
              <Trans>Enviar ahora</Trans>
            </Button>
          </>
        }
      >
        {null}
      </Modal>

      <Modal
        isOpen={confirming === 'cancel'}
        onClose={close}
        title={i18n._(msg`¿Cancelar «${campaign.name}»?`)}
        description={i18n._(
          msg`Los mensajes que aún no salieron ya no se envían. No se puede deshacer.`,
        )}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              <Trans>Volver</Trans>
            </Button>
            <Button variant="primary" disabled={isLoading} onClick={() => void run('cancel')}>
              <Trans>Cancelar campaña</Trans>
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    </div>
  )
}
