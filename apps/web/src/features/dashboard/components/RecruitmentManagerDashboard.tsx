import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { useGetRecruitmentOverviewQuery } from '../api/roleDashboardsApi'

import { StatTile } from './ActivityCards'
import { IdentityHeader } from './IdentityHeader'
import { RequisitionMiniList } from './RequisitionMiniList'

import { useGetRecruitmentTeamQuery } from '@/features/team'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { LoadError } from '@/shared/components/LoadError'
import type { RecruitmentTeamMemberApi } from '@/shared/types/apiContract.types'
import type { SessionUser } from '@/shared/types/session.types'

const MS_PER_DAY = 86_400_000
/** Sin un alta ni una asignación en una semana, alguien del equipo necesita que lo miren. */
const QUIET_DAYS = 7
const TEAM_ROWS = 6

function isQuiet(member: RecruitmentTeamMemberApi): boolean {
  if (!member.lastActivityAt) return true
  return Date.now() - new Date(member.lastActivityAt).getTime() > QUIET_DAYS * MS_PER_DAY
}

/** La carga del equipo de un vistazo; el detalle de cada quien vive en Mi Equipo. */
function TeamLoadCard({ members }: { members: RecruitmentTeamMemberApi[] }): ReactNode {
  const { t } = useLingui()
  const rows = [...members]
    .sort((a, b) => b.activeRequisitions - a.activeRequisitions)
    .slice(0, TEAM_ROWS)
  const quiet = members.filter(isQuiet).length

  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">
          <Trans>Tu equipo</Trans>
        </h2>
        <Link to="/my-team" className="text-sm font-medium text-o-700 hover:underline">
          <Trans>Ver Mi Equipo</Trans>
        </Link>
      </div>
      <p className="mt-0.5 text-sm text-ink-3">
        {quiet === 0
          ? t`Todo tu equipo tuvo actividad en la última semana.`
          : t`${String(quiet)} sin altas ni asignaciones en 7 días o más.`}
      </p>
      {members.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-line px-3 py-6 text-center text-sm text-ink-4">
          <Trans>Nadie te reporta todavía. Asigna tu equipo en Usuarios con «Reporta a».</Trans>
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th scope="col" className="py-2 pr-3 font-medium">
                  <Trans>Persona</Trans>
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  <Trans>Llenando</Trans>
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  <Trans>Asignaciones · 30 d</Trans>
                </th>
                <th scope="col" className="py-2 pl-3 text-right font-medium">
                  <Trans>Por validar</Trans>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((member) => (
                <tr key={member.id} className="border-t border-line">
                  <td className="py-2.5 pr-3">
                    <Link
                      to={`/my-team?persona=${member.id}`}
                      className="block font-medium text-ink hover:text-o-700 hover:underline"
                    >
                      {member.fullName}
                    </Link>
                    <span
                      className={cn('block text-xs', isQuiet(member) ? 'text-red' : 'text-ink-3')}
                    >
                      {isQuiet(member) ? t`Sin actividad en 7 días o más` : member.role.name}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-ink tabular-nums">
                    {member.activeRequisitions}
                  </td>
                  <td className="px-3 py-2.5 text-right text-ink-2 tabular-nums">
                    {member.assignmentsLast30Days}
                  </td>
                  <td className="py-2.5 pl-3 text-right text-ink-2 tabular-nums">
                    {member.pendingValidation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/**
 * El tablero de la Manager de Reclutamiento: lo del departamento entero, no lo
 * de una Reclutadora. Lo que el vault le pide y todavía no existe (casos
 * escalados e Indicador de Calidad) se dice tal cual, sin cifras inventadas.
 */
export function RecruitmentManagerDashboard({ session }: { session: SessionUser }): ReactNode {
  const { t } = useLingui()
  const overview = useGetRecruitmentOverviewQuery()
  const team = useGetRecruitmentTeamQuery()

  if (overview.isLoading || team.isLoading) {
    return <CardGridSkeleton cards={6} className="grid-cols-1 md:grid-cols-2 xl:grid-cols-3" />
  }

  if (overview.isError || !overview.data) {
    return (
      <LoadError
        message={t`No se pudo cargar el dashboard. Reintenta en unos segundos.`}
        onRetry={() => {
          void overview.refetch()
        }}
      />
    )
  }

  const data = overview.data

  return (
    <div className="flex flex-col gap-6">
      <IdentityHeader name={session.name} subtitle={session.roleTitle} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          value={String(data.criticalCount)}
          label={t`Requisiciones críticas`}
          foot={t`Autorizadas hace más de 24 h, sin tomar`}
          tintClass={data.criticalCount > 0 ? 'bg-red/10' : 'bg-surface-2'}
          delay={0.05}
        />
        <StatTile
          value={String(data.queueOpen)}
          label={t`En cola`}
          foot={t`Autorizadas, sin tomar (Self-Pick)`}
          tintClass="bg-st-azul-claro/10"
          delay={0.12}
        />
        <StatTile
          value={String(data.queueInProgress)}
          label={t`En proceso`}
          foot={t`Tomadas por tu equipo`}
          tintClass="bg-o-500/10"
          delay={0.18}
        />
        <StatTile
          value={String(data.queuePartial)}
          label={t`Cubiertas parcialmente`}
          foot={t`Con lugares todavía sin llenar`}
          tintClass="bg-surface-2"
          delay={0.24}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <RequisitionMiniList
          title={t`Requisiciones críticas`}
          subtitle={t`Autorizadas hace más de 24 h y nadie las ha tomado; la más vieja primero`}
          requisitions={data.critical}
          emptyLabel={t`Ninguna requisición lleva más de 24 h esperando.`}
        />
        {team.isError || !team.data ? (
          <LoadError
            message={t`No se pudo cargar tu equipo. Reintenta en unos segundos.`}
            onRetry={() => {
              void team.refetch()
            }}
          />
        ) : (
          <TeamLoadCard members={team.data} />
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="text-base font-semibold text-ink">
            <Trans>Pool por estado</Trans>
          </h2>
          <p className="mt-0.5 text-sm text-ink-3">
            <Trans>
              Semáforo del Colaborador · hoy · {String(data.poolPendingValidation)} por validar
            </Trans>
          </p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {data.poolByState.map((state) => (
              <li key={state.code} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm text-ink-2">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: state.color }}
                  />
                  {state.name}
                </span>
                <span className="text-sm font-semibold text-ink tabular-nums">{state.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-dashed border-line bg-surface p-5">
          <h2 className="text-base font-semibold text-ink">
            <Trans>Todavía sin construir</Trans>
          </h2>
          <ul className="mt-3 flex flex-col gap-3 text-sm text-ink-3">
            <li>
              <Trans>
                <span className="font-medium text-ink-2">Casos escalados.</span> Los que te escalan
                Líderes e Inspectores llegarán con la pantalla de{' '}
                <Link to="/incidents" className="font-medium text-o-700 hover:underline">
                  Incidencias
                </Link>
                .
              </Trans>
            </li>
            <li>
              <Trans>
                <span className="font-medium text-ink-2">Indicador de Calidad.</span> Lo mide QA,
                que todavía no tiene su módulo.
              </Trans>
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}
