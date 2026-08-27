import { cn } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { useGetTeamOverviewQuery } from '../api/teamApi'
import { AssignTerritoryDialog } from '../components/AssignTerritoryDialog'
import type { TeamMemberCard } from '../types/team.types'

import bdcIllustration from '@/assets/ilustrations/bdc.svg'
import { Button } from '@/shared/components/Button'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { EmptyState } from '@/shared/components/EmptyState'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { MetricCard } from '@/shared/components/MetricCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatList, formatPercent } from '@/shared/lib/formatters'

function initialsOf(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
}

function Metric({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="text-xl font-bold text-ink">{value}</p>
    </div>
  )
}

/** La fila de la lista izquierda: quién es y cuánto trae abierto, de un vistazo. */
function MemberRow({
  member,
  isSelected,
  onSelect,
}: {
  member: TeamMemberCard
  isSelected: boolean
  onSelect: (memberId: string) => void
}): ReactNode {
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onSelect(member.id)
        }}
        className={cn(
          'flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
          isSelected ? 'border-o-500 bg-o-50' : 'border-line bg-surface hover:bg-surface-2',
        )}
      >
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-o-500/15 text-sm font-bold text-o-700"
        >
          {initialsOf(member.fullName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{member.fullName}</span>
          <span className="block text-xs text-ink-3">
            {member.openProspects} {member.openProspects === 1 ? 'abierto' : 'abiertos'}
            {member.staleCount > 0 && ` · ${String(member.staleCount)} sin actividad`}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-2">
          {member.quarterConversions} conv.
        </span>
      </button>
    </li>
  )
}

/** El panel de la derecha: el BD elegido a fondo, con sus ciclos en tabla. */
function MemberDetail({
  member,
  onAssignTerritory,
}: {
  member: TeamMemberCard
  onAssignTerritory: (member: TeamMemberCard) => void
}): ReactNode {
  return (
    <article className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex size-16 items-center justify-center rounded-full bg-o-500/15 text-xl font-bold text-o-700"
          >
            {initialsOf(member.fullName)}
          </span>
          <div>
            <h2 className="text-2xl font-bold text-ink">{member.fullName}</h2>
            <p className="text-sm text-ink-3">
              BD ·{' '}
              {member.zoneNames.length > 0
                ? `Zonas ${formatList(member.zoneNames)}`
                : 'sin territorio asignado todavía'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            title="Las zonas donde este BD trabaja sus prospectos"
            onClick={() => {
              onAssignTerritory(member)
            }}
          >
            Asignar territorio
          </Button>
          {}
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
      </header>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg bg-surface-2 p-4 sm:grid-cols-5">
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

      <div>
        <p className="text-sm font-semibold text-ink">Sus ciclos abiertos</p>
        {member.openCycles.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">
            Sin ciclos abiertos ahora mismo: todo lo suyo está convertido o cerrado.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-line rounded-lg border border-line">
            {member.openCycles.map((cycle) => (
              <li key={cycle.prospectId}>
                <Link
                  to={`/pipeline/${cycle.prospectId}`}
                  className="flex items-center justify-between gap-4 p-3 transition-colors hover:bg-surface-2"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-ink">
                    {cycle.hotelName}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span
                      className={cn(
                        'text-xs',
                        cycle.daysSinceAttempt >= 7 ? 'font-semibold text-red' : 'text-ink-3',
                      )}
                    >
                      {cycle.daysSinceAttempt === 0
                        ? 'contactado hoy'
                        : `hace ${String(cycle.daysSinceAttempt)} d`}
                    </span>
                    <StatusLightSoftBadge
                      token={ONBOARDING_STATUS_TOKEN[cycle.status]}
                      label={ONBOARDING_STATUS_LABEL[cycle.status]}
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  )
}

export function TeamPage(): ReactNode {
  const { data: overview, isLoading, isError, error, refetch } = useGetTeamOverviewQuery()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [territoryMember, setTerritoryMember] = useState<TeamMemberCard | null>(null)

  const status = (error as { status?: number } | undefined)?.status

  if (isLoading) {
    return <CardGridSkeleton cards={4} className="grid-cols-1 md:grid-cols-2 xl:grid-cols-4" />
  }

  if (isError || !overview) {
    if (status === 403) {
      return (
        <p className="rounded-lg border border-line bg-surface p-6 text-sm text-ink-2">
          Mi Equipo es la pantalla del BDC: tu rol no tiene BDs a cargo.
        </p>
      )
    }
    return (
      <LoadError
        message="No se pudo cargar el equipo."
        onRetry={() => {
          void refetch()
        }}
      />
    )
  }

  const selected =
    overview.members.find((member) => member.id === selectedId) ?? overview.members[0]

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text="Mi Equipo" />
          </h1>
          <p className="mt-1.5 text-sm text-ink-3">
            Los BDs que te reportan y cómo va su ciclo comercial
          </p>
        </div>
        <img src={bdcIllustration} alt="" aria-hidden className="hidden h-20 w-auto sm:block" />
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
          foot={IS_DEV_UI ? 'Rosa → Naranja · RR-V-01' : 'Rosa → Naranja'}
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

      {overview.members.length === 0 ? (
        <EmptyState
          title="Nadie te reporta todavía"
          text="Los BDs de tu equipo se asignan en el alta de personal: cuando alguien tenga «Reporta a» con tu nombre, aparecerá aquí."
        />
      ) : (
        /* Lista a la izquierda, detalle a la derecha: un BD siempre elegido. */
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[300px_1fr]">
          <ul className="flex flex-col gap-2">
            {overview.members.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                isSelected={member.id === selected?.id}
                onSelect={setSelectedId}
              />
            ))}
          </ul>

          {selected && <MemberDetail member={selected} onAssignTerritory={setTerritoryMember} />}
        </div>
      )}

      <AssignTerritoryDialog
        member={territoryMember}
        onClose={() => {
          setTerritoryMember(null)
        }}
      />
    </div>
  )
}
