import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon } from '@oranje/ui'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'

import { useAppPendingTimesheetsQuery } from './home/hotelHomeApi'
import { computeHotelKpis } from './home/hotelKpis'
import { InviteAccountCard } from './home/InviteAccountCard'
import { WeekCostCard } from './home/WeekCostCard'
import { useAppRequisitionsQuery } from './requisitions/requisitionsAppApi'

import { useAppSelector } from '@/app/hooks'
import { useGetSessionQuery } from '@/app/sessionApi'
import { selectSessionUser } from '@/app/sessionSlice'
import { LoadError } from '@/shared/components/LoadError'
import { MetricCard } from '@/shared/components/MetricCard'
import { roleLabelOf } from '@/shared/constants/roles'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatPercent } from '@/shared/lib/formatters'

/** «18 h» o «2.5 días»: lo que tarda en firmarse una requisición. */
function useDurationLabel(): (hours: number) => string {
  const { t } = useLingui()
  return (hours) => {
    if (hours < 48) {
      const rounded = Math.max(1, Math.round(hours))
      return t`${rounded} h`
    }
    const days = (hours / 24).toFixed(1)
    return t`${days} días`
  }
}

/**
 * Inicio del hotel en la app: quién eres y, sobre todo, cómo va tu personal.
 * Los KPIs salen de las requisiciones que el API ya recorta por alcance (D-09:
 * el Manager General ve todo el hotel; el Supervisor y el Manager de Área, su
 * departamento). Cada métrica lleva a la lista ya filtrada.
 */
export function HotelHomePage(): ReactNode {
  const { t } = useLingui()
  const can = useCan()
  const durationLabel = useDurationLabel()
  const user = useAppSelector(selectSessionUser)
  const { data: session } = useGetSessionQuery()
  const { data: rows, isLoading, error, refetch } = useAppRequisitionsQuery()
  const canSeeTimesheets = can('timesheet:approve_hours')
  const { data: pendingTimesheets } = useAppPendingTimesheetsQuery(undefined, {
    skip: !canSeeTimesheets,
  })

  const kpis = useMemo(() => computeHotelKpis(rows ?? []), [rows])
  const name = session?.name ?? user?.name ?? ''
  const firstName = name.trim().split(/\s+/)[0] ?? ''
  const role = roleLabelOf(session?.roleId ?? user?.roleId ?? '')
  const scope = session?.department?.name ?? t`Todo el hotel`
  const maxDemand = kpis.demandByDepartment[0]?.open ?? 0

  return (
    <div className="flex flex-col gap-5 pb-4">
      <section className="flex flex-col gap-1 rounded-2xl bg-ink p-5 text-surface">
        <p className="text-sm text-surface/70">
          <Trans>Hola, {firstName}</Trans>
        </p>
        <h1 className="text-xl font-bold">{role.title}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-surface/85">
          <span className="inline-flex items-center gap-1.5">
            <MaterialIcon name="apartment" className="text-base text-o-300" aria-hidden />
            {session?.hotel?.name ?? '—'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MaterialIcon name="groups" className="text-base text-o-300" aria-hidden />
            {scope}
          </span>
        </p>
      </section>

      {error ? (
        <LoadError
          message={apiErrorMessage(error, {
            fallback: t`No se pudieron cargar las requisiciones.`,
          })}
          onRetry={() => {
            void refetch()
          }}
        />
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-3" aria-busy aria-label={t`Cargando`}>
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="h-32 animate-pulse rounded-xl bg-surface-2" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              value={String(kpis.awaitingAuthorization)}
              label={t`Por autorizar`}
              foot={t`Esperan la firma de un Manager`}
              icon="draw"
              tone={kpis.awaitingAuthorization > 0 ? 'danger' : 'brand'}
              to="/hotel/requisitions?filter=draft"
            />
            <MetricCard
              value={String(kpis.open)}
              label={t`Abiertas`}
              foot={t`Reclutamiento las está cubriendo`}
              icon="assignment"
              to="/hotel/requisitions?filter=open"
            />
            <MetricCard
              value={String(kpis.urgent)}
              label={t`Urgentes`}
              foot={t`Empiezan en menos de 3 días`}
              icon="priority_high"
              tone={kpis.urgent > 0 ? 'danger' : 'brand'}
              to="/hotel/requisitions"
            />
            <MetricCard
              value={String(kpis.openSlots)}
              label={t`Lugares por cubrir`}
              foot={t`Personas que faltan en las abiertas`}
              icon="person_search"
              to="/hotel/requisitions?filter=open"
            />
          </div>

          <WeekCostCard />

          <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink">
                <Trans>Cobertura de las abiertas</Trans>
              </h2>
              <span className="text-2xl font-semibold text-ink tabular-nums">
                {kpis.fillRate === null ? '—' : formatPercent(kpis.fillRate)}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={t`Cobertura`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((kpis.fillRate ?? 0) * 100)}
              className="h-2.5 overflow-hidden rounded-full bg-surface-3"
            >
              <div
                className="h-full rounded-full bg-o-500"
                style={{ width: `${String(Math.round((kpis.fillRate ?? 0) * 100))}%` }}
              />
            </div>
            <p className="text-xs text-ink-3">
              {kpis.fillRate === null ? (
                <Trans>No hay requisiciones abiertas ahora.</Trans>
              ) : (
                <Trans>Lugares cubiertos de lo que pediste y sigue abierto.</Trans>
              )}
            </p>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <section className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs text-ink-3">
                <Trans>Tiempo para autorizar</Trans>
              </p>
              <p className="text-xl font-semibold text-ink tabular-nums">
                {kpis.avgHoursToAuthorize === null ? '—' : durationLabel(kpis.avgHoursToAuthorize)}
              </p>
              <p className="text-xs text-ink-3">
                <Trans>Promedio, últimos 90 días</Trans>
              </p>
            </section>
            {canSeeTimesheets && (
              <section className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
                <p className="text-xs text-ink-3">
                  <Trans>Timesheets por aprobar</Trans>
                </p>
                <p className="text-xl font-semibold text-ink tabular-nums">
                  {pendingTimesheets ?? '—'}
                </p>
                <p className="text-xs text-ink-3">
                  <Trans>Enviados por el Supervisor</Trans>
                </p>
              </section>
            )}
          </div>

          <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold text-ink">
              <Trans>Lo que falta por departamento</Trans>
            </h2>
            {kpis.demandByDepartment.length === 0 ? (
              <p className="text-sm text-ink-3">
                <Trans>No falta nadie en las requisiciones abiertas.</Trans>
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {kpis.demandByDepartment.slice(0, 5).map((item) => (
                  <li key={item.department} className="flex flex-col gap-1">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="truncate text-ink-2">{item.department}</span>
                      <span className="font-semibold text-ink tabular-nums">{item.open}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full bg-o-500"
                        style={{
                          width: `${String(Math.round((item.open / Math.max(maxDemand, 1)) * 100))}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <InviteAccountCard />

          <Link
            to="/hotel/requisitions"
            className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-line text-sm font-semibold text-ink-2"
          >
            <Trans>Ver todas las requisiciones</Trans>
            <MaterialIcon name="arrow_forward" className="text-lg" aria-hidden />
          </Link>
        </>
      )}
    </div>
  )
}
