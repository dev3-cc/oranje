import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

import {
  useGetMessagingOverviewQuery,
  type CampaignStatus,
  type RecentCampaign,
} from '../api/messagingApi'
import { useGetMessagingWorkersQuery } from '../api/messagingWorkersApi'

import personajeConfiguracion from '@/assets/ilustrations/personaje-configuracion.svg'
import { LoadError } from '@/shared/components/LoadError'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatDateTime } from '@/shared/lib/formatters'

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
 * El Panel de la plataforma de mensajería (meta-mensajes) dentro de Oranje:
 * sus tres cifras —contactos, plantillas y campañas, como el original (Hugo,
 * 2026-10-23)— y las últimas campañas. Los datos los trae el API de Oranje, que entra a la
 * plataforma con su cuenta de servicio: aquí no hay un segundo login.
 */
export function MessagingOverviewPanel(): ReactNode {
  const { i18n } = useLingui()
  const { data, isLoading, isError, error, refetch } = useGetMessagingOverviewQuery()
  /* Colaboradores, no contactos de la plataforma: lo mismo que lista la
     sección (Hugo, 2026-10-23), con sus permisos. Quien no puede listarlos
     (403) ve «—»; el resto del Panel sigue igual. */
  const { data: workers } = useGetMessagingWorkersQuery({
    page: 1,
    search: '',
    state: '',
    hotelId: '',
  })

  if (isError) {
    return (
      <LoadError
        message={apiErrorMessage(error, {
          fallback: i18n._(msg`No se pudo cargar el Panel de Mensajería.`),
        })}
        onRetry={(): void => void refetch()}
      />
    )
  }

  if (isLoading || !data) {
    return <div className="h-64 animate-pulse rounded-lg bg-surface-3" />
  }

  if (!data.configured) {
    return (
      <NoticeCard
        tone="warning"
        image={personajeConfiguracion}
        title={i18n._(msg`Este ambiente no está conectado a la plataforma de mensajería`)}
      >
        <Trans>
          Faltan las variables MESSAGING_API_* en el API. Cuando se configuren, aquí aparecen los
          contactos, las plantillas y las campañas.
        </Trans>
      </NoticeCard>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Cifra label={<Trans>Colaboradores</Trans>} value={workers?.meta.total ?? null} />
        <Cifra label={<Trans>Plantillas</Trans>} value={data.templates} />
        <Cifra label={<Trans>Campañas</Trans>} value={data.campaigns} highlight />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">
          <Trans>Campañas recientes</Trans>
        </h2>
        <RecentCampaigns rows={data.recentCampaigns} />
      </section>
    </div>
  )
}

function Cifra({
  label,
  value,
  highlight = false,
}: {
  label: ReactNode
  /** `null`: la cifra no se puede mostrar (sin permiso o todavía cargando). */
  value: number | null
  highlight?: boolean
}): ReactNode {
  return (
    <div className="rounded-lg border border-line bg-surface p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</p>
      <p
        className={cn(
          'mt-1 text-3xl font-black tracking-tight',
          value === null ? 'text-ink-3' : highlight && value > 0 ? 'text-o-700' : 'text-ink',
        )}
      >
        {value ?? '—'}
      </p>
    </div>
  )
}

function RecentCampaigns({ rows }: { rows: RecentCampaign[] }): ReactNode {
  const { i18n } = useLingui()

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-surface p-5 text-center text-sm text-ink-3">
        <Trans>Todavía no hay campañas.</Trans>
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-3">
          <tr>
            <th className="px-4 py-3 font-semibold">
              <Trans>Campaña</Trans>
            </th>
            <th className="px-4 py-3 font-semibold">
              <Trans>Estado</Trans>
            </th>
            <th className="px-4 py-3 font-semibold">
              <Trans>Progreso</Trans>
            </th>
            <th className="px-4 py-3 font-semibold">
              <Trans>Creada</Trans>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((campaign) => {
            /* La plataforma es de otro equipo: un estado nuevo se muestra tal
               cual en vez de tumbar la tabla. */
            const status = STATUS[campaign.status] as (typeof STATUS)[CampaignStatus] | undefined
            return (
              <tr key={campaign.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{campaign.name}</p>
                  {campaign.templateName !== null && (
                    <p className="text-xs text-ink-3">{campaign.templateName}</p>
                  )}
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
                <td className="px-4 py-3 text-ink-2 tabular-nums">
                  {campaign.sentCount}/{campaign.totalRecipients}
                </td>
                <td className="px-4 py-3 text-ink-3">{formatDateTime(campaign.createdAt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
