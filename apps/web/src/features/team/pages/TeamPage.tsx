import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { useGetTeamOverviewQuery } from '../api/teamApi'
import { AssignTerritoryDialog } from '../components/AssignTerritoryDialog'
import type { TeamMemberCard } from '../types/team.types'

import bdcIllustration from '@/assets/ilustrations/bdc.svg'
import personajeAcceso from '@/assets/ilustrations/personaje-acceso-protegido.svg'
import { Button } from '@/shared/components/Button'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { EmptyState } from '@/shared/components/EmptyState'
import { FoldText } from '@/shared/components/FoldText'
import { HotelThumbnail } from '@/shared/components/HotelThumbnail'
import { LoadError } from '@/shared/components/LoadError'
import { MagicCard } from '@/shared/components/MagicCard'
import { MetricCard } from '@/shared/components/MetricCard'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { SearchField } from '@/shared/components/SearchField'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatList, formatPercent } from '@/shared/lib/formatters'
import { matchesSearch } from '@/shared/lib/text'

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
  const { t } = useLingui()
  return (
    <li>
      {/* Magic Bento (reactbits): la fila avisa al pasar; se apaga sola en táctil y reduced motion. */}
      <MagicCard className="rounded-xl">
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
          {member.photoUrl ? (
            <img
              src={member.photoUrl}
              alt=""
              aria-hidden
              className="size-11 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-o-500/15 text-sm font-bold text-o-700"
            >
              {initialsOf(member.fullName)}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{member.fullName}</span>
            <span className="block text-xs text-ink-3">
              <Plural value={member.openProspects} one="# abierto" other="# abiertos" />
              {member.staleCount > 0 && ` · ${t`${member.staleCount} sin actividad`}`}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-2">
            <Trans>{member.quarterConversions} conv.</Trans>
          </span>
        </button>
      </MagicCard>
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
  const { t } = useLingui()
  return (
    /* Detalle fijo mientras la lista baja (lista-detalle, como la Cartera y el Pool). */
    <article className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-var(--hd)-3rem)] lg:overflow-y-auto">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {member.photoUrl ? (
            <img
              src={member.photoUrl}
              alt=""
              aria-hidden
              className="size-16 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-16 items-center justify-center rounded-full bg-o-500/15 text-xl font-bold text-o-700"
            >
              {initialsOf(member.fullName)}
            </span>
          )}
          <div>
            <h2 className="text-2xl font-bold text-ink">{member.fullName}</h2>
            <p className="text-sm text-ink-3">
              <Trans>
                BD ·{' '}
                {member.zoneNames.length > 0
                  ? t`Zonas ${formatList(member.zoneNames)}`
                  : t`sin territorio asignado todavía`}
              </Trans>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            title={t`Las zonas donde este BD trabaja sus prospectos`}
            onClick={() => {
              onAssignTerritory(member)
            }}
          >
            <Trans>Asignar territorio</Trans>
          </Button>
          {}
          <Button variant="secondary" disabled title={t`Las notas al BD llegan pronto`}>
            <Trans>Nota al BD</Trans>
          </Button>
          <Button
            variant="secondary"
            disabled
            title={t`Los reportes por BD llegan con la pantalla de Reportes`}
          >
            <Trans>Solicitar reporte</Trans>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg bg-surface-2 p-4 sm:grid-cols-5">
        <Metric label={t`Prospectos abiertos`} value={String(member.openProspects)} />
        <Metric label={t`Conversiones (trim.)`} value={String(member.quarterConversions)} />
        <Metric label={t`Tasa de conversión`} value={formatPercent(member.conversionRate)} />
        <Metric
          label={t`Días prom. a Naranja`}
          value={
            member.averageConversionDays === null
              ? '—'
              : `${String(member.averageConversionDays)} d`
          }
        />
        <Metric label={t`Sin actividad 7+ días`} value={String(member.staleCount)} />
      </div>

      <div>
        <p className="text-xs text-ink-3">
          <Trans>Ciclos abiertos por estado</Trans>
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
        <p className="text-sm font-semibold text-ink">
          <Trans>Sus ciclos abiertos</Trans>
        </p>
        {member.openCycles.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">
            <Trans>Sin ciclos abiertos ahora mismo: todo lo suyo está convertido o cerrado.</Trans>
          </p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-line rounded-lg border border-line">
            {member.openCycles.map((cycle) => (
              <li key={cycle.prospectId}>
                <Link
                  to={`/pipeline/${cycle.prospectId}`}
                  className="flex items-center justify-between gap-4 p-3 transition-colors hover:bg-surface-2"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <HotelThumbnail photoUrl={cycle.hotelPhotoUrl} className="size-8" />
                    <span className="min-w-0 truncate text-sm font-medium text-ink">
                      {cycle.hotelName}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span
                      className={cn(
                        'text-xs',
                        cycle.daysSinceAttempt >= 7 ? 'font-semibold text-red' : 'text-ink-3',
                      )}
                    >
                      {cycle.daysSinceAttempt === 0
                        ? t`contactado hoy`
                        : t`hace ${String(cycle.daysSinceAttempt)} d`}
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
  const { t } = useLingui()
  const { data: overview, isLoading, isError, error, refetch } = useGetTeamOverviewQuery()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [territoryMember, setTerritoryMember] = useState<TeamMemberCard | null>(null)
  /** Por nombre, EN MEMORIA: el equipo ya está cargado entero. */
  const [search, setSearch] = useState('')

  const status = (error as { status?: number } | undefined)?.status

  if (isLoading) {
    return <CardGridSkeleton cards={4} className="grid-cols-1 md:grid-cols-2 xl:grid-cols-4" />
  }

  if (isError || !overview) {
    if (status === 403) {
      return (
        <NoticeCard image={personajeAcceso} title={t`Mi Equipo solo la ve el BDC`} role="status">
          <Trans>Tu rol no tiene BDs a cargo, así que aquí no hay nada que mostrar.</Trans>
        </NoticeCard>
      )
    }
    return (
      <LoadError
        message={t`No se pudo cargar Mi Equipo. Reintenta en unos segundos.`}
        onRetry={() => {
          void refetch()
        }}
      />
    )
  }

  const visibleMembers = overview.members.filter((member) => matchesSearch(search, member.fullName))
  /* El elegido sale de lo VISIBLE: si la búsqueda lo deja fuera, el panel
     pasa al primero que sí se ve, y sin nadie visible no se pinta a nadie. */
  const selected = visibleMembers.find((member) => member.id === selectedId) ?? visibleMembers[0]

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text={t`Mi Equipo`} />
          </h1>
          <p className="mt-1.5 text-sm text-ink-3">
            <Trans>Los BDs que te reportan y cómo va su ciclo comercial</Trans>
          </p>
        </div>
        <img src={bdcIllustration} alt="" aria-hidden className="hidden h-20 w-auto sm:block" />
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          value={String(overview.memberCount)}
          label={t`BDs a cargo`}
          foot={IS_DEV_UI ? 'identity.user · reports_to' : t`te reportan directo`}
        />
        <MetricCard
          value={String(overview.openProspects)}
          label={t`Prospectos abiertos del equipo`}
          foot={t`solo ciclos abiertos`}
        />
        <MetricCard
          value={String(overview.quarterConversions)}
          label={t`Conversiones del trimestre`}
          foot={IS_DEV_UI ? 'Rosa → Naranja · RR-V-01' : t`Rosa → Naranja`}
        />
        <MetricCard
          value={
            overview.averageConversionDays === null
              ? '—'
              : `${String(overview.averageConversionDays)} d`
          }
          label={t`Días promedio a Naranja`}
          foot={IS_DEV_UI ? 'prospect_state_history' : t`de abrir el ciclo a convertir`}
        />
      </div>

      {overview.members.length === 0 ? (
        <EmptyState
          title={t`Nadie te reporta todavía`}
          text={t`Los BDs de tu equipo se asignan en el alta de personal: cuando alguien tenga «Reporta a» con tu nombre, aparecerá aquí.`}
        />
      ) : (
        /* Lista a la izquierda, detalle a la derecha: un BD siempre elegido. */
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[300px_1fr]">
          <div className="flex flex-col gap-3">
            <SearchField
              value={search}
              onChange={setSearch}
              label={t`Buscar BD`}
              placeholder={t`Nombre del BD, p. ej. Rocío Lima…`}
            />
            {visibleMembers.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-3">
                <Trans>
                  Ningún BD de tu equipo se llama «{search.trim()}». Cambia la búsqueda o límpiala
                  para ver a todos.
                </Trans>
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {visibleMembers.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    isSelected={member.id === selected?.id}
                    onSelect={setSelectedId}
                  />
                ))}
              </ul>
            )}
          </div>

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
