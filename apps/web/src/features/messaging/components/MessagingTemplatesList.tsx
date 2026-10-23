import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { MaterialIcon, cn, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import {
  useGetMessagingTemplatesQuery,
  useSyncMessagingTemplatesMutation,
  type MessagingTemplate,
  type TemplateCategory,
  type TemplateStatus,
} from '../api/messagingTemplatesApi'

import { ANY_FILTER, MessagingFilters } from './MessagingFilters'

import personajeConfiguracion from '@/assets/ilustrations/personaje-configuracion.svg'
import personajeSinResultados from '@/assets/ilustrations/personaje-sin-resultados.svg'
import { Button } from '@/shared/components/Button'
import { LoadError } from '@/shared/components/LoadError'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatDateTime } from '@/shared/lib/formatters'

const STATUS: Record<TemplateStatus, { label: MessageDescriptor; className: string }> = {
  APPROVED: { label: msg`Aprobada`, className: 'bg-st-verde/15 text-st-verde' },
  PENDING: { label: msg`En revisión`, className: 'bg-st-amarillo/20 text-ink-2' },
  REJECTED: { label: msg`Rechazada`, className: 'bg-st-rojo/10 text-st-rojo' },
  PAUSED: { label: msg`Pausada`, className: 'bg-surface-2 text-ink-3' },
  DISABLED: { label: msg`Deshabilitada`, className: 'bg-surface-2 text-ink-3' },
}

const CATEGORY: Record<TemplateCategory, MessageDescriptor> = {
  MARKETING: msg`Marketing`,
  UTILITY: msg`Utilidad`,
  AUTHENTICATION: msg`Autenticación`,
}

/**
 * Las plantillas de WhatsApp de la plataforma de mensajería: las que Meta ya
 * aprobó son las que se pueden usar en una campaña. Se ven como tarjetas con
 * su texto, para saber qué dice cada una sin abrir Meta (Hugo, 2026-10-23).
 * Meta no las pagina y son pocas: el filtro por estado es en pantalla.
 */
export function MessagingTemplatesList(): ReactNode {
  const { i18n } = useLingui()
  const [status, setStatus] = useState(ANY_FILTER)
  const { data, isLoading, isError, error, refetch } = useGetMessagingTemplatesQuery()
  const [sync, { isLoading: isSyncing }] = useSyncMessagingTemplatesMutation()

  const runSync = async (): Promise<void> => {
    try {
      const result = await sync().unwrap()
      toast.success(
        i18n._(
          msg`${result.synced} sincronizadas: ${result.created} nuevas y ${result.updated} actualizadas.`,
        ),
      )
    } catch (caught) {
      toast.error(
        apiErrorMessage(caught, {
          fallback: i18n._(msg`No se pudieron sincronizar las plantillas.`),
        }),
      )
    }
  }

  if (isError) {
    return (
      <LoadError
        message={apiErrorMessage(error, {
          fallback: i18n._(msg`No se pudieron cargar las plantillas.`),
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
          plantillas.
        </Trans>
      </NoticeCard>
    )
  }

  const all = data?.configured === true ? data.templates : []
  const visible = status === ANY_FILTER ? all : all.filter((template) => template.status === status)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">
            <Trans>Plantillas</Trans>
          </h2>
          <p className="text-sm text-ink-3">
            <Trans>Mensajes aprobados por Meta, disponibles para usar en campañas.</Trans>
          </p>
        </div>
        <Button
          variant="primary"
          className="h-10"
          disabled={isSyncing || isLoading}
          onClick={() => void runSync()}
        >
          <MaterialIcon name="sync" className={cn('text-lg', isSyncing && 'animate-spin')} />
          {isSyncing ? <Trans>Sincronizando…</Trans> : <Trans>Sincronizar desde Meta</Trans>}
        </Button>
      </div>

      <MessagingFilters
        status={{
          value: status,
          options: (Object.keys(STATUS) as TemplateStatus[]).map((value) => ({
            value,
            label: i18n._(STATUS[value].label),
          })),
          onChange: setStatus,
        }}
      />

      {isLoading || !data ? (
        <div className="h-64 animate-pulse rounded-lg bg-surface-3" />
      ) : visible.length === 0 ? (
        <NoticeCard
          image={personajeSinResultados}
          title={all.length === 0 ? i18n._(msg`Sin plantillas`) : i18n._(msg`Nadie coincide`)}
        >
          {all.length === 0 ? (
            <Trans>Usa «Sincronizar desde Meta» para traer las plantillas aprobadas.</Trans>
          ) : (
            <Trans>Ninguna plantilla está en ese estado.</Trans>
          )}
        </NoticeCard>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visible.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </ul>
      )}
    </div>
  )
}

function TemplateCard({ template }: { template: MessagingTemplate }): ReactNode {
  const { i18n } = useLingui()
  /* La plataforma es de otro equipo: un estado o categoría nuevos se muestran
     tal cual en vez de romper la tarjeta. */
  const status = STATUS[template.status] as (typeof STATUS)[TemplateStatus] | undefined
  const category = CATEGORY[template.category] as MessageDescriptor | undefined

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{template.name}</p>
          <p className="text-xs text-ink-3">
            {category ? i18n._(category) : template.category} · {template.language} ·{' '}
            {template.variableCount === 1 ? (
              <Trans>1 variable</Trans>
            ) : (
              <Trans>{template.variableCount} variables</Trans>
            )}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
            status?.className ?? 'bg-surface-2 text-ink-3',
          )}
        >
          {status ? i18n._(status.label) : template.status}
        </span>
      </div>

      {template.body !== null && (
        /* El texto tal cual lo verá quien lo recibe, con sus {{1}} sin rellenar. */
        <p className="line-clamp-4 whitespace-pre-line rounded-md bg-surface-2 p-3 text-sm text-ink-2">
          {template.body}
        </p>
      )}

      {template.status === 'REJECTED' && template.rejectionReason !== null && (
        <p className="text-xs text-st-rojo">
          <Trans>Motivo del rechazo: {template.rejectionReason}</Trans>
        </p>
      )}

      <p className="mt-auto text-xs text-ink-3">
        <Trans>Sincronizada {formatDateTime(template.syncedAt)}</Trans>
      </p>
    </li>
  )
}
