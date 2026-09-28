import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import {
  useGetMailSettingsQuery,
  useSetMailTransportMutation,
  type MailDeliveryRow,
  type MailSettings,
  type MailTransport,
} from '../api/mailSettingsApi'

import personajeConfiguracion from '@/assets/ilustrations/personaje-configuracion.svg'
import { LoadError } from '@/shared/components/LoadError'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatDateTime } from '@/shared/lib/formatters'

/**
 * El freno de mano del correo.
 *
 * Hay dos cosas que se parecen y no son lo mismo, y la pantalla tiene que
 * distinguirlas o el interruptor engaña:
 *
 * - **el respaldo automático** actúa cuando el servidor FALLA, solo y sin
 *   avisar;
 * - **este interruptor** existe para lo otro: cuando el servidor acepta el
 *   correo y no lo entrega. Ahí, para el sistema, todo salió bien.
 *
 * Por eso arriba va el resumen de los últimos días: sin saber qué ha pasado,
 * mover el interruptor sería un acto de fe.
 */
export function MailSettingsPage(): ReactNode {
  const { t } = useLingui()
  const can = useCan()
  const canManage = can('settings:manage')

  const { data, isLoading, isError, refetch } = useGetMailSettingsQuery()
  const [setTransport, { isLoading: isSaving }] = useSetMailTransportMutation()
  const [error, setError] = useState<string | null>(null)

  async function choose(transport: MailTransport): Promise<void> {
    if (!data || transport === data.transport) return

    setError(null)
    try {
      await setTransport(transport).unwrap()
      toast.success(
        transport === 'own'
          ? t`El correo vuelve a salir por el servidor de Oranje`
          : t`El correo saldrá por Firebase hasta que lo regreses`,
      )
    } catch (caught) {
      setError(
        apiErrorMessage(caught, {
          fallback: t`No se pudo cambiar el ajuste. Inténtalo de nuevo.`,
        }),
      )
    }
  }

  if (isError) {
    return (
      <LoadError
        message={t`No se pudieron cargar los ajustes del correo.`}
        onRetry={(): void => void refetch()}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[22px] font-bold text-ink">
          <Trans>Ajustes del correo</Trans>
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          <Trans>
            Por dónde salen los correos que manda el sistema, y qué ha pasado con ellos.
          </Trans>
        </p>
      </header>

      {isLoading || !data ? (
        <div className="h-64 animate-pulse rounded-[18px] bg-surface-3" />
      ) : (
        <>
          <EstadoActual settings={data} />

          <section className="rounded-[18px] border border-line bg-surface p-5">
            <h2 className="text-base font-semibold text-ink">
              <Trans>Por dónde sale el correo</Trans>
            </h2>
            <p className="mt-1 mb-4 text-sm text-ink-3">
              <Trans>
                Si el servidor de Oranje falla, el sistema se pasa a Firebase él solo. Cambia esto a
                mano solo cuando el correo parezca salir bien pero no llegue.
              </Trans>
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <OpcionTransporte
                value="own"
                current={data.transport}
                disabled={!canManage || isSaving}
                title={t`Servidor de Oranje`}
                detail={t`Nuestras plantillas, remitente @oranjepeople.com.`}
                icon="mark_email_read"
                onChoose={choose}
              />
              <OpcionTransporte
                value="firebase"
                current={data.transport}
                disabled={!canManage || isSaving}
                title={t`Firebase (respaldo)`}
                detail={t`La plantilla de Firebase, que no se puede editar. Solo para salir del paso.`}
                icon="backup"
                onChoose={choose}
              />
            </div>

            {data.updatedAt !== null && (
              <p className="mt-3 text-xs text-ink-3">
                <Trans>Última vez que se cambió: {formatDateTime(data.updatedAt)}</Trans>
              </p>
            )}

            {!canManage && (
              <p className="mt-3 text-xs text-ink-3">
                <Trans>Cambiar esto es del Administrador.</Trans>
              </p>
            )}

            {error !== null && (
              <p role="alert" className="mt-4 text-sm text-st-rojo">
                {error}
              </p>
            )}
          </section>

          <UltimosEnvios rows={data.recent} />
        </>
      )}
    </div>
  )
}

/** La respuesta a «¿está funcionando?», antes que cualquier control. */
function EstadoActual({ settings }: { settings: MailSettings }): ReactNode {
  const { t } = useLingui()
  const { own, fallback, failed, days } = settings.summary

  if (!settings.configured) {
    return (
      <NoticeCard
        tone="warning"
        image={personajeConfiguracion}
        title={t`Este ambiente no manda correo propio`}
      >
        <Trans>
          No tiene servidor de correo configurado, así que todo sale por Firebase. El interruptor de
          abajo no cambia nada hasta que se configure.
        </Trans>
      </NoticeCard>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Cifra
        label={<Trans>Por el servidor de Oranje</Trans>}
        value={own}
        days={days}
        tone={settings.sendingWithOwnServer ? 'ok' : 'muted'}
      />
      <Cifra
        label={<Trans>Por el respaldo</Trans>}
        value={fallback}
        days={days}
        tone={fallback > 0 ? 'warning' : 'muted'}
      />
      <Cifra
        label={<Trans>Sin salir</Trans>}
        value={failed}
        days={days}
        tone={failed > 0 ? 'danger' : 'muted'}
      />
    </div>
  )
}

function Cifra({
  label,
  value,
  days,
  tone,
}: {
  label: ReactNode
  value: number
  days: number
  tone: 'ok' | 'warning' | 'danger' | 'muted'
}): ReactNode {
  /* El cero se pinta en gris aunque la tarjeta sea de alerta: un cero es una
     buena noticia y no tiene por qué gritar (receta de las KPI cards). */
  const color =
    value === 0
      ? 'text-ink-3'
      : tone === 'ok'
        ? 'text-st-verde'
        : tone === 'warning'
          ? 'text-o-700'
          : tone === 'danger'
            ? 'text-st-rojo'
            : 'text-ink'

  return (
    <div className="rounded-[18px] border border-line bg-surface p-4">
      <p className="text-sm text-ink-3">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-ink-3">
        <Trans>en los últimos {days} días</Trans>
      </p>
    </div>
  )
}

function OpcionTransporte({
  value,
  current,
  disabled,
  title,
  detail,
  icon,
  onChoose,
}: {
  value: MailTransport
  current: MailTransport
  disabled: boolean
  title: string
  detail: string
  icon: string
  onChoose: (value: MailTransport) => Promise<void>
}): ReactNode {
  const selected = current === value

  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={(): void => void onChoose(value)}
      className={`flex cursor-pointer items-start gap-3 rounded-[18px] border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        selected ? 'border-o-500 bg-o-50' : 'border-line bg-surface hover:bg-surface-2'
      }`}
    >
      <MaterialIcon name={icon} className={selected ? 'text-o-700' : 'text-ink-3'} />
      <span className="flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-xs text-ink-3">{detail}</span>
      </span>
      {/* La marca no es solo el color: el borde naranja sin palomita se lee mal en gris. */}
      {selected && <MaterialIcon name="check_circle" className="text-o-700" />}
    </button>
  )
}

function UltimosEnvios({ rows }: { rows: MailDeliveryRow[] }): ReactNode {
  return (
    <section className="rounded-[18px] border border-line bg-surface p-5">
      <h2 className="text-base font-semibold text-ink">
        <Trans>Últimos correos</Trans>
      </h2>

      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink-3">
          <Trans>Todavía no ha salido ningún correo desde este ambiente.</Trans>
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {rows.map((row) => (
            <li key={`${row.createdAt}-${row.toEmail}`} className="flex flex-wrap gap-x-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{row.toEmail}</span>
              <span className="text-xs text-ink-3">
                {row.transport === 'SMTP' ? (
                  <Trans>Servidor de Oranje</Trans>
                ) : (
                  <Trans>Respaldo</Trans>
                )}
              </span>
              <span className={`text-xs ${row.status === 'SENT' ? 'text-ink-3' : 'text-st-rojo'}`}>
                {row.status === 'SENT' ? <Trans>Enviado</Trans> : <Trans>No salió</Trans>}
              </span>
              <span className="text-xs text-ink-3">{formatDateTime(row.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
