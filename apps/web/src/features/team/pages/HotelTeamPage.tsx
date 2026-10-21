import { plural } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useState, type ReactNode } from 'react'

import { useGetHotelTeamQuery } from '../api/hotelTeamApi'
import { MemberAvatar } from '../components/MemberAvatar'

import fotoEquipo from '@/assets/ilustrations/equipo-hotel.webp'
import personajeAcceso from '@/assets/ilustrations/personaje-acceso-protegido.svg'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { EmptyState } from '@/shared/components/EmptyState'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { SearchField } from '@/shared/components/SearchField'
import { matchesSearch } from '@/shared/lib/text'
import type { HotelTeamMemberApi } from '@/shared/types/apiContract.types'
import type { SessionUser } from '@/shared/types/session.types'

const MANAGER_DE_AREA = 'ROL-H-02'
const SUPERVISOR = 'ROL-H-01'

function Pill({ children }: { children: ReactNode }): ReactNode {
  return (
    <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-2">
      {children}
    </span>
  )
}

function Email({ email }: { email: string }): ReactNode {
  return (
    <a
      href={`mailto:${email}`}
      className="block truncate text-xs text-ink-3 hover:text-o-700 hover:underline"
    >
      {email}
    </a>
  )
}

function SupervisorRow({ member }: { member: HotelTeamMemberApi }): ReactNode {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <MemberAvatar fullName={member.fullName} photoUrl={member.photoUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{member.fullName}</p>
        <Email email={member.email} />
      </div>
      <Pill>
        <Plural
          value={member.requisitionsThisMonth ?? 0}
          one="# requisición este mes"
          other="# requisiciones este mes"
        />
      </Pill>
    </li>
  )
}

/** Un Manager de Área con sus números y, debajo, los Supervisores que le reportan. */
function ManagerGroup({
  manager,
  supervisors,
}: {
  manager: HotelTeamMemberApi
  supervisors: HotelTeamMemberApi[]
}): ReactNode {
  const { t } = useLingui()
  const department = manager.department?.name
  return (
    <section
      aria-label={manager.fullName}
      className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface"
    >
      <header className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-4">
          <MemberAvatar fullName={manager.fullName} photoUrl={manager.photoUrl} size="lg" />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-ink">{manager.fullName}</h2>
            <p className="text-sm text-ink-3">
              {department ? `${manager.role.name} · ${department}` : manager.role.name}
            </p>
            <Email email={manager.email} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill>
            <Plural
              value={manager.supervisorsInCharge ?? 0}
              one="# supervisor a cargo"
              other="# supervisores a cargo"
            />
          </Pill>
          <Pill>
            {manager.activeWorkers === null ? (
              <Trans>Sin departamento asignado</Trans>
            ) : (
              <Plural
                value={manager.activeWorkers}
                one="# colaborador activo"
                other="# colaboradores activos"
              />
            )}
          </Pill>
        </div>
      </header>
      {supervisors.length === 0 ? (
        <p className="border-t border-line px-5 py-4 text-sm text-ink-3">
          <Trans>Todavía no tiene Supervisores a cargo.</Trans>
        </p>
      ) : (
        <ul
          aria-label={t`Supervisores de ${manager.fullName}`}
          className="divide-y divide-line border-t border-line"
        >
          {supervisors.map((supervisor) => (
            <SupervisorRow key={supervisor.id} member={supervisor} />
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Mi Equipo del Manager General: sus Managers de Área y los Supervisores de
 * cada uno. Por ahora solo quién es quién y tres números (Hugo, 2026-10-21);
 * comunicar, solicitar reportes y escalar llegan después.
 */
export function HotelTeamPage({ session }: { session: SessionUser }): ReactNode {
  const { t } = useLingui()
  const { data: members, isLoading, isError, error, refetch } = useGetHotelTeamQuery()
  const [search, setSearch] = useState('')

  const status = (error as { status?: number } | undefined)?.status

  if (isLoading) {
    return <CardGridSkeleton cards={4} className="grid-cols-1 xl:grid-cols-2" />
  }

  if (isError || !members) {
    if (status === 403) {
      return (
        <NoticeCard
          image={personajeAcceso}
          title={t`Mi Equipo del Hotel es del Manager General`}
          role="status"
        >
          <Trans>
            Tu rol no tiene gerentes ni supervisores a cargo, así que aquí no hay nada que mostrar.
          </Trans>
        </NoticeCard>
      )
    }
    return (
      <LoadError
        message={t`No se pudo cargar tu equipo. Reintenta en unos segundos.`}
        onRetry={() => {
          void refetch()
        }}
      />
    )
  }

  const managers = members.filter((member) => member.role.code === MANAGER_DE_AREA)
  const supervisors = members.filter((member) => member.role.code === SUPERVISOR)
  const managerIds = new Set(managers.map((manager) => manager.id))
  const supervisorsOf = (managerId: string): HotelTeamMemberApi[] =>
    supervisors.filter((supervisor) => supervisor.reportsTo?.id === managerId)
  const unassigned = supervisors.filter(
    (supervisor) => !managerIds.has(supervisor.reportsTo?.id ?? ''),
  )

  const matches = (member: HotelTeamMemberApi): boolean => matchesSearch(search, member.fullName)
  const visibleGroups = managers
    .map((manager) => ({
      manager,
      supervisors: matches(manager)
        ? supervisorsOf(manager.id)
        : supervisorsOf(manager.id).filter(matches),
    }))
    .filter((group) => matches(group.manager) || group.supervisors.length > 0)
  const visibleUnassigned = unassigned.filter(matches)
  const hasResults = visibleGroups.length > 0 || visibleUnassigned.length > 0

  return (
    <div className="flex flex-col gap-6">
      <header className="relative flex items-end justify-between gap-4 rounded-2xl border border-line bg-gradient-to-r from-o-50 via-surface to-surface px-6 pt-5 pb-5 [clip-path:inset(-3rem_0_0_0_round_1rem)] sm:mt-8 sm:min-h-44 sm:pr-80">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text={t`Mi Equipo`} />
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-ink-3">
            {session.hotel
              ? t`Los gerentes y supervisores de ${session.hotel.name}`
              : t`Tus gerentes y supervisores`}
          </p>
          <p className="mt-1 text-sm font-medium text-ink-2">
            {t`${plural(managers.length, { one: '# Manager de Área', other: '# Managers de Área' })} y ${plural(
              supervisors.length,
              { one: '# Supervisor', other: '# Supervisores' },
            )}`}
          </p>
        </div>
        <img
          src={fotoEquipo}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-2 -bottom-1 hidden h-[calc(100%+2.5rem)] w-auto object-contain object-bottom drop-shadow-[0_10px_18px_rgba(60,30,0,0.26)] md:block"
        />
      </header>

      {members.length === 0 ? (
        <EmptyState
          title={t`Todavía no hay gerentes ni supervisores en tu hotel`}
          text={t`Invítalos desde tu Dashboard, en «¿Entró un Supervisor o un gerente nuevo?».`}
        />
      ) : (
        <>
          <div className="max-w-sm">
            <SearchField
              value={search}
              onChange={setSearch}
              label={t`Buscar en tu equipo`}
              placeholder={t`Nombre, p. ej. Alma Torres…`}
            />
          </div>

          {!hasResults ? (
            <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-3">
              <Trans>
                Nadie de tu equipo se llama «{search.trim()}». Cambia la búsqueda o límpiala para
                ver a todos.
              </Trans>
            </p>
          ) : (
            <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
              {visibleGroups.map((group) => (
                <ManagerGroup
                  key={group.manager.id}
                  manager={group.manager}
                  supervisors={group.supervisors}
                />
              ))}
              {visibleUnassigned.length > 0 && (
                <section
                  aria-label={t`Supervisores sin Manager de Área`}
                  className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface"
                >
                  <header className="p-5">
                    <h2 className="text-lg font-bold text-ink">
                      <Trans>Supervisores sin Manager de Área</Trans>
                    </h2>
                    <p className="text-sm text-ink-3">
                      <Trans>No reportan a ningún Manager de Área de tu hotel.</Trans>
                    </p>
                  </header>
                  <ul className="divide-y divide-line border-t border-line">
                    {visibleUnassigned.map((supervisor) => (
                      <SupervisorRow key={supervisor.id} member={supervisor} />
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
