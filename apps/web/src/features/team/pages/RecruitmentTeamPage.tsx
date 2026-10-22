import { plural } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { cn, MaterialIcon, Tabs, TabsContent, TabsList, TabsTrigger } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'

import { useGetRecruitmentTeamQuery } from '../api/recruitmentTeamApi'
import { MemberAvatar } from '../components/MemberAvatar'
import { MoveRecruiterDialog, type TeamLeadOption } from '../components/MoveRecruiterDialog'

import fotoEquipo from '@/assets/ilustrations/equipo-hotel.webp'
import personajeAcceso from '@/assets/ilustrations/personaje-acceso-protegido.svg'
import { BackToListButton } from '@/shared/components/BackToListButton'
import { Button } from '@/shared/components/Button'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { EmptyState } from '@/shared/components/EmptyState'
import { FoldText } from '@/shared/components/FoldText'
import { ListItemViewHint } from '@/shared/components/ListItemViewHint'
import { LoadError } from '@/shared/components/LoadError'
import { MagicCard } from '@/shared/components/MagicCard'
import { MetricCard } from '@/shared/components/MetricCard'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { SearchField } from '@/shared/components/SearchField'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  REQUISITION_STATUS_LABEL,
  REQUISITION_STATUS_TOKEN,
  REQUISITION_STATUSES,
  type RequisitionStatus,
} from '@/shared/constants/requisitionStatus'
import {
  workerStatusChipLabel,
  WORKER_STATUS_TOKEN,
  WORKER_STATUSES,
  type WorkerStatus,
} from '@/shared/constants/workerStatus'
import { rosterDetailClass, rosterListClass, useListDetail } from '@/shared/hooks/useListDetail'
import { formatDayMonth } from '@/shared/lib/formatters'
import { matchesSearch } from '@/shared/lib/text'
import type { RecruitmentTeamMemberApi } from '@/shared/types/apiContract.types'
import type { SessionUser } from '@/shared/types/session.types'

const LIDER = 'ROL-R-02'
const RECLUTADORA = 'ROL-R-01'
const MS_PER_DAY = 86_400_000

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / MS_PER_DAY))
}

function LastActivity({ iso }: { iso: string | null }): ReactNode {
  if (!iso) return <Trans>Sin altas ni asignaciones todavía</Trans>
  const days = daysSince(iso)
  if (days === 0) return <Trans>Última actividad hoy</Trans>
  return (
    <Plural value={days} one="Última actividad hace # día" other="Última actividad hace # días" />
  )
}

/** Un grupo de la lista: una Líder con sus Reclutadoras, o las que le reportan directo a la Manager. */
interface TeamGroup {
  key: string
  title: string
  lead: RecruitmentTeamMemberApi | null
  members: RecruitmentTeamMemberApi[]
}

function groupTeam(
  members: RecruitmentTeamMemberApi[],
  directTitle: string,
  groupTitle: (name: string) => string,
): TeamGroup[] {
  const leads = members.filter((member) => member.role.code === LIDER)
  const leadIds = new Set(leads.map((lead) => lead.id))
  const groups: TeamGroup[] = leads.map((lead) => ({
    key: lead.id,
    title: groupTitle(lead.fullName),
    lead,
    members: members.filter(
      (member) => member.role.code === RECLUTADORA && member.reportsTo?.id === lead.id,
    ),
  }))
  const direct = members.filter(
    (member) => member.role.code === RECLUTADORA && !leadIds.has(member.reportsTo?.id ?? ''),
  )
  if (direct.length > 0)
    groups.push({ key: 'directo', title: directTitle, lead: null, members: direct })
  return groups
}

function MemberRow({
  member,
  isSelected,
  onSelect,
}: {
  member: RecruitmentTeamMemberApi
  isSelected: boolean
  onSelect: (memberId: string) => void
}): ReactNode {
  return (
    <li>
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
          <MemberAvatar fullName={member.fullName} photoUrl={member.photoUrl} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{member.fullName}</span>
            <span className="block truncate text-xs text-ink-3">
              <LastActivity iso={member.lastActivityAt} />
            </span>
          </span>
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
              member.activeRequisitions > 0 ? 'bg-o-50 text-o-700' : 'bg-surface-2 text-ink-3',
            )}
          >
            <Trans>Llenando {member.activeRequisitions}</Trans>
          </span>
          <ListItemViewHint />
        </button>
      </MagicCard>
    </li>
  )
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}): ReactNode {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="text-xl font-bold text-ink tabular-nums">{value}</p>
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  )
}

function isRequisitionStatus(code: string): code is RequisitionStatus {
  return (REQUISITION_STATUSES as readonly string[]).includes(code)
}

const LINK_ROW_CLASS =
  'flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-o-500'

interface WorkerLink {
  id: string
  fullName: string
  createdAt: string
  statusCode?: string
}

function isWorkerStatus(code: string): code is WorkerStatus {
  return (WORKER_STATUSES as readonly string[]).includes(code)
}

/** Altas de una persona, cada una enlazada a su expediente en el Pool. */
function WorkerLinkList({
  workers,
  hidden,
  empty,
}: {
  workers: WorkerLink[]
  /** Las que existen pero el servidor no listó por el tope. */
  hidden: number
  empty: string
}): ReactNode {
  const { t } = useLingui()
  if (workers.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm text-ink-3">
        {empty}
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
        {workers.map((worker) => (
          <li key={worker.id}>
            <Link to={`/collaborator-pool/${worker.id}`} className={LINK_ROW_CLASS}>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">
                  {worker.fullName}
                </span>
                <span className="block text-xs text-ink-3">
                  {t`Alta del ${formatDayMonth(worker.createdAt)}`}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {worker.statusCode && isWorkerStatus(worker.statusCode) && (
                  <StatusLightSoftBadge
                    token={WORKER_STATUS_TOKEN[worker.statusCode]}
                    label={workerStatusChipLabel(worker.statusCode)}
                  />
                )}
                <MaterialIcon name="chevron_right" className="text-lg text-ink-4" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <Link to="/collaborator-pool" className="text-xs font-medium text-o-700 hover:underline">
          <Plural
            value={hidden}
            one="# más: búscala en el Pool de Colaboradores"
            other="# más: búscalas en el Pool de Colaboradores"
          />
        </Link>
      )}
    </div>
  )
}

/**
 * Lo que se abre desde la persona: cada requisición que está llenando y a
 * quiénes dio de alta. Requisiciones y Pool todavía no filtran por
 * Reclutadora, así que se enlaza al detalle de cada una.
 */
function MemberLinks({ member }: { member: RecruitmentTeamMemberApi }): ReactNode {
  const { t } = useLingui()
  const hasWorkers = member.workersCreatedLast30Days > 0 || member.pendingValidation > 0
  if (member.openRequisitions.length === 0 && !hasWorkers) return null

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
      {member.openRequisitions.length > 0 && (
        <section aria-label={t`Requisiciones que está llenando`} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink">
            <Trans>Requisiciones que está llenando</Trans>
          </h3>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
            {member.openRequisitions.map((requisition) => (
              <li key={requisition.id}>
                <Link to={`/requisitions/${requisition.id}`} className={LINK_ROW_CLASS}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {requisition.hotelName}
                    </span>
                    <span className="block truncate text-xs text-ink-3 tabular-nums">
                      {requisition.number}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {isRequisitionStatus(requisition.statusCode) && (
                      <StatusLightSoftBadge
                        token={REQUISITION_STATUS_TOKEN[requisition.statusCode]}
                        label={REQUISITION_STATUS_LABEL[requisition.statusCode]}
                      />
                    )}
                    <MaterialIcon name="chevron_right" className="text-lg text-ink-4" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasWorkers && (
        <section aria-label={t`Sus altas`} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink">
            <Trans>Sus altas</Trans>
          </h3>
          <Tabs defaultValue="recent" className="gap-2">
            <TabsList>
              <TabsTrigger value="recent">
                <Trans>Últimos 30 días · {String(member.workersCreatedLast30Days)}</Trans>
              </TabsTrigger>
              <TabsTrigger value="pending">
                <Trans>Por validar · {String(member.pendingValidation)}</Trans>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="recent">
              <WorkerLinkList
                workers={member.recentWorkers}
                hidden={member.workersCreatedLast30Days - member.recentWorkers.length}
                empty={t`No dio de alta a nadie en los últimos 30 días.`}
              />
            </TabsContent>
            <TabsContent value="pending">
              <WorkerLinkList
                workers={member.pendingWorkers}
                hidden={member.pendingValidation - member.pendingWorkers.length}
                empty={t`Ninguna de sus altas sigue en Blanco.`}
              />
            </TabsContent>
          </Tabs>
        </section>
      )}
    </div>
  )
}

function MemberDetail({
  member,
  onMove,
  showDetailOnMobile,
  onBack,
}: {
  member: RecruitmentTeamMemberApi
  onMove: (member: RecruitmentTeamMemberApi) => void
  showDetailOnMobile: boolean
  onBack: () => void
}): ReactNode {
  const { t } = useLingui()
  const isLead = member.role.code === LIDER
  return (
    <article
      className={cn(
        'flex-col gap-6 rounded-xl border border-line bg-surface p-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-var(--hd)-3rem)] lg:overflow-y-auto',
        rosterDetailClass(showDetailOnMobile),
      )}
    >
      <BackToListButton onClick={onBack} />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <MemberAvatar fullName={member.fullName} photoUrl={member.photoUrl} size="lg" />
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-ink">{member.fullName}</h2>
            <p className="text-sm text-ink-3">
              {member.role.name}
              {member.reportsTo && ` · ${t`reporta a ${member.reportsTo.fullName}`}`}
            </p>
            <a
              href={`mailto:${member.email}`}
              className="block text-xs break-all text-ink-3 hover:text-o-700 hover:underline"
            >
              {member.email}
            </a>
          </div>
        </div>
        {!isLead && (
          <Button
            variant="secondary"
            onClick={() => {
              onMove(member)
            }}
          >
            <Trans>Cambiar de Líder</Trans>
          </Button>
        )}
      </header>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg bg-surface-2 p-4 sm:grid-cols-3">
        <Metric
          label={t`Está llenando`}
          value={String(member.activeRequisitions)}
          hint={t`Requisiciones autorizadas, en proceso o cubiertas parcialmente`}
        />
        <Metric label={t`Requisiciones cubiertas`} value={String(member.coveredRequisitions)} />
        <Metric label={t`Asignaciones · 30 días`} value={String(member.assignmentsLast30Days)} />
        <Metric
          label={t`Altas · 30 días`}
          value={String(member.workersCreatedLast30Days)}
          hint={t`Colaboradores que dio de alta`}
        />
        <Metric
          label={t`Por validar`}
          value={String(member.pendingValidation)}
          hint={t`Dados de alta, todavía en Blanco`}
        />
        <Metric
          label={t`Última actividad`}
          value={member.lastActivityAt ? formatDayMonth(member.lastActivityAt) : '—'}
          {...(member.lastActivityAt ? {} : { hint: t`Sin altas ni asignaciones todavía` })}
        />
      </div>

      <MemberLinks member={member} />

      {isLead && (
        <p className="text-sm text-ink-3">
          <Trans>
            Como Líder, también recluta y asigna: sus números son los suyos, no los de su grupo. Las
            Reclutadoras de su grupo aparecen debajo de ella en la lista.
          </Trans>
        </p>
      )}
    </article>
  )
}

export function RecruitmentTeamPage({ session }: { session: SessionUser }): ReactNode {
  const { t } = useLingui()
  const { data: members, isLoading, isError, error, refetch } = useGetRecruitmentTeamQuery()
  /** `?persona=<id>` llega desde el tablero y Reportes: abre a esa persona. */
  const [searchParams] = useSearchParams()
  const linkedId = searchParams.get('persona')
  const [selectedId, setSelectedId] = useState<string | null>(linkedId)
  const [moving, setMoving] = useState<RecruitmentTeamMemberApi | null>(null)
  const [search, setSearch] = useState('')
  const { showDetailOnMobile, select, backToList } = useListDetail(linkedId !== null)

  const status = (error as { status?: number } | undefined)?.status

  if (isLoading) {
    return <CardGridSkeleton cards={4} className="grid-cols-1 md:grid-cols-2 xl:grid-cols-4" />
  }

  if (isError || !members) {
    if (status === 403) {
      return (
        <NoticeCard
          image={personajeAcceso}
          title={t`Mi Equipo es de la Manager de Reclutamiento`}
          role="status"
        >
          <Trans>
            Tu rol no tiene Líderes ni Reclutadoras a cargo, así que aquí no hay nada que mostrar.
          </Trans>
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

  const visible = members.filter((member) => matchesSearch(search, member.fullName))
  const groups = groupTeam(visible, t`Te reportan directo`, (name) => t`Grupo de ${name}`)
  const ordered = groups.flatMap((group) => [...(group.lead ? [group.lead] : []), ...group.members])
  const selected = ordered.find((member) => member.id === selectedId) ?? ordered[0]

  const leadOptions: TeamLeadOption[] = [
    ...members
      .filter((member) => member.role.code === LIDER)
      .map((lead) => ({ id: lead.id, label: lead.fullName })),
    { id: session.id, label: t`Directo contigo` },
  ]

  const totalOpen = members.reduce((sum, member) => sum + member.activeRequisitions, 0)
  const totalAssignments = members.reduce((sum, member) => sum + member.assignmentsLast30Days, 0)
  const totalPending = members.reduce((sum, member) => sum + member.pendingValidation, 0)
  const leadCount = members.filter((member) => member.role.code === LIDER).length

  return (
    <div className="flex flex-col gap-6">
      <header className="relative flex items-end justify-between gap-4 rounded-2xl border border-line bg-gradient-to-r from-o-50 via-surface to-surface px-6 pt-5 pb-5 [clip-path:inset(-3rem_0_0_0_round_1rem)] sm:mt-8 sm:min-h-44 sm:pr-80">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text={t`Mi Equipo`} />
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-ink-3">
            <Trans>Tus Líderes y Reclutadoras, y cómo va el trabajo de cada una</Trans>
          </p>
        </div>
        <img
          src={fotoEquipo}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-2 -bottom-1 hidden h-[calc(100%+2.5rem)] w-auto object-contain object-bottom drop-shadow-[0_10px_18px_rgba(60,30,0,0.26)] md:block"
        />
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          value={String(members.length)}
          label={t`Personas en tu equipo`}
          foot={t`${plural(leadCount, { one: '# Líder', other: '# Líderes' })} y ${plural(
            members.length - leadCount,
            { one: '# Reclutadora', other: '# Reclutadoras' },
          )}`}
        />
        <MetricCard
          value={String(totalOpen)}
          label={t`Requisiciones que están llenando`}
          foot={t`Tomadas por tu equipo y sin cubrir del todo`}
        />
        <MetricCard
          value={String(totalAssignments)}
          label={t`Asignaciones · 30 días`}
          foot={t`Colaboradores puestos en un hotel`}
        />
        <MetricCard
          value={String(totalPending)}
          label={t`Por validar`}
          foot={t`Altas de tu equipo todavía en Blanco`}
          {...(totalPending > 0 ? { tone: 'brand' as const } : {})}
        />
      </div>

      {members.length === 0 ? (
        <EmptyState
          title={t`Nadie te reporta todavía`}
          text={t`Las Líderes y Reclutadoras se asignan en Usuarios: cuando alguien tenga «Reporta a» con tu nombre, aparecerá aquí.`}
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[320px_1fr]">
          <div className={cn('flex-col gap-4', rosterListClass(showDetailOnMobile))}>
            <SearchField
              value={search}
              onChange={setSearch}
              label={t`Buscar en tu equipo`}
              placeholder={t`Nombre, p. ej. Alejandra Cohuo…`}
            />
            {visible.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-3">
                <Trans>
                  Nadie de tu equipo se llama «{search.trim()}». Cambia la búsqueda o límpiala para
                  ver a todos.
                </Trans>
              </p>
            ) : (
              groups.map((group) => (
                <section key={group.key} className="flex flex-col gap-2" aria-label={group.title}>
                  <h2 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
                    {group.title}
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {[...(group.lead ? [group.lead] : []), ...group.members].map((member) => (
                      <MemberRow
                        key={member.id}
                        member={member}
                        isSelected={member.id === selected?.id}
                        onSelect={(id) => {
                          setSelectedId(id)
                          select()
                        }}
                      />
                    ))}
                  </ul>
                  {group.lead && group.members.length === 0 && (
                    <p className="text-xs text-ink-3">
                      <Trans>Todavía no tiene Reclutadoras en su grupo.</Trans>
                    </p>
                  )}
                </section>
              ))
            )}
          </div>

          {selected && (
            <MemberDetail
              member={selected}
              onMove={setMoving}
              showDetailOnMobile={showDetailOnMobile}
              onBack={backToList}
            />
          )}
        </div>
      )}

      <MoveRecruiterDialog
        member={moving}
        options={leadOptions}
        onClose={() => {
          setMoving(null)
        }}
      />
    </div>
  )
}
