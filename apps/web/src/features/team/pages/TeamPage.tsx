import type { ReactNode } from 'react'

import { useGetTeamOverviewQuery } from '../api/teamApi'
import type { TeamMemberCard } from '../types/team.types'

import { Button } from '@/shared/components/Button'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { MetricCard } from '@/shared/components/MetricCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatList, formatPercent } from '@/shared/lib/formatters'

/** Una métrica del BD: etiqueta chica arriba, número grande abajo. */
function Metric({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="text-xl font-bold text-ink">{value}</p>
    </div>
  )
}

function MemberCard({ member }: { member: TeamMemberCard }): ReactNode {
  return (
    <article className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
      <div>
        <h3 className="text-lg font-bold text-ink">{member.fullName}</h3>
        <p className="text-sm text-ink-3">
          BD ·{' '}
          {member.zoneNames.length > 0
            ? `Zonas ${formatList(member.zoneNames)}`
            : 'sin territorio asignado todavía'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
        <Metric label="Prospectos abiertos" value={String(member.openProspects)} />
        <Metric label="Conversiones (trim.)" value={String(member.quarterConversions)} />
        <Metric label="Tasa de conversión" value={formatPercent(member.conversionRate)} />
        <Metric
          label="Días prom. a Naranja"
          value={
            member.averageConversionDays === null
              ? '—'
              : `${String(member.averageConversionDays)} d`
          }
        />
        <Metric label="Sin actividad 7+ días" value={String(member.staleCount)} />
      </div>

      <div>
        <p className="text-xs text-ink-3">
          Ciclos abiertos por estado
          {IS_DEV_UI && <code className="text-ink-4"> · prospect.onboarding_state_id</code>}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {member.byState.map(({ status, count }) => (
            <StatusLightSoftBadge
              key={status}
              token={ONBOARDING_STATUS_TOKEN[status]}
              label={`${ONBOARDING_STATUS_LABEL[status]} · ${String(count)}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-auto flex flex-wrap justify-end gap-3">
        {/* Sin backend todavía: los botones lo dicen, no fingen enviar nada. */}
        <Button variant="secondary" disabled title="Las notas al BD aún no existen en el backend">
          Nota al BD
        </Button>
        <Button
          variant="secondary"
          disabled
          title="Los reportes por BD llegan con la pantalla de Reportes"
        >
          Solicitar reporte
        </Button>
      </div>
    </article>
  )
}

/**
 * Mi Equipo (maqueta del BDC): sus BDs con las métricas del ciclo comercial,
 * compuestas de `/team` + `/prospects` (D-28). Un BD no tiene equipo: el
 * backend le responde 403 a `/team` y esta pantalla se lo dice.
 */
export function TeamPage(): ReactNode {
  const { data: overview, isLoading, isError, error } = useGetTeamOverviewQuery()

  const status = (error as { status?: number } | undefined)?.status

  if (isLoading) {
    return <CardGridSkeleton cards={4} className="grid-cols-1 md:grid-cols-2 xl:grid-cols-4" />
  }

  if (isError || !overview) {
    return (
      <p className="rounded-lg border border-line bg-surface p-6 text-sm text-ink-2">
        {status === 403
          ? 'Mi Equipo es la pantalla del BDC: tu rol no tiene BDs a cargo.'
          : 'No se pudo cargar el equipo. Reintenta en unos segundos.'}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Mi Equipo</h1>
        <p className="mt-1.5 text-sm text-ink-3">
          Los BDs que te reportan y cómo va su ciclo comercial
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          value={String(overview.memberCount)}
          label="BDs a cargo"
          foot={IS_DEV_UI ? 'identity.user · reports_to' : 'te reportan directo'}
        />
        <MetricCard
          value={String(overview.openProspects)}
          label="Prospectos abiertos del equipo"
          foot="solo ciclos abiertos"
        />
        <MetricCard
          value={String(overview.quarterConversions)}
          label="Conversiones del trimestre"
          foot="Rosa → Naranja · RR-V-01"
        />
        <MetricCard
          value={
            overview.averageConversionDays === null
              ? '—'
              : `${String(overview.averageConversionDays)} d`
          }
          label="Días promedio a Naranja"
          foot={IS_DEV_UI ? 'prospect_state_history' : 'de abrir el ciclo a convertir'}
        />
      </div>

      <div className="flex flex-col gap-5">
        {overview.members.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>
    </div>
  )
}
