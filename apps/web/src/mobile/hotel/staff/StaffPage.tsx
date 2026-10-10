import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { useAppStaffBoardQuery } from './staffAppApi'
import { StaffAvatar, stateColor, stateLabel, TodayStatus } from './staffParts'

import personajePerfil from '@/assets/ilustrations/personaje-perfil.svg'
import { EmptyState } from '@/shared/components/EmptyState'
import { LoadError } from '@/shared/components/LoadError'
import { SearchField } from '@/shared/components/SearchField'
import { apiErrorMessage } from '@/shared/lib/apiError'

/**
 * Mi personal: los colaboradores asignados al hotel (o al departamento, según
 * el alcance), con su semáforo siempre visible, su turno de hoy y si ya
 * marcaron entrada. Tocar a alguien abre su ficha con Stand-by y Reportar.
 */
export function StaffPage(): ReactNode {
  const { t } = useLingui()
  const { data: board, isLoading, error, refetch, isFetching } = useAppStaffBoardQuery()
  const [query, setQuery] = useState('')

  const needle = query.trim().toLowerCase()
  const members = (board?.members ?? []).filter(
    (member) =>
      needle === '' ||
      member.fullName.toLowerCase().includes(needle) ||
      (member.positionName ?? '').toLowerCase().includes(needle),
  )

  const tiles = board
    ? [
        { label: t`Con turno hoy`, value: board.withShiftToday },
        { label: t`Ya entraron`, value: board.clockedInToday },
        { label: t`En Stand-by`, value: board.inStandBy },
        { label: t`Accidentados`, value: board.inAccident },
      ]
    : []

  return (
    <div className="flex flex-col gap-4 pb-4">
      <h1 className="text-xl font-bold text-ink">
        <Trans>Mi personal</Trans>
      </h1>

      {isLoading ? (
        <div className="flex flex-col gap-3" aria-busy aria-label={t`Cargando`}>
          <div className="h-20 animate-pulse rounded-2xl bg-surface-2" />
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-20 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      ) : error ? (
        <LoadError
          message={apiErrorMessage(error, { fallback: t`No se pudo cargar tu personal.` })}
          onRetry={() => {
            void refetch()
          }}
        />
      ) : (
        <>
          <dl className="grid grid-cols-4 gap-2 rounded-2xl bg-surface-2 p-3 text-center">
            {tiles.map((tile) => (
              <div key={tile.label} className="flex flex-col gap-0.5">
                <dd
                  className={cn(
                    'text-xl font-semibold tabular-nums',
                    tile.value === 0 ? 'text-ink-3' : 'text-ink',
                  )}
                >
                  {tile.value}
                </dd>
                <dt className="text-[11px] leading-tight text-ink-3">{tile.label}</dt>
              </div>
            ))}
          </dl>

          {(board?.members.length ?? 0) > 6 && (
            <SearchField
              value={query}
              onChange={setQuery}
              label={t`Buscar en tu personal`}
              placeholder={t`Busca por nombre o puesto`}
            />
          )}

          {members.length === 0 ? (
            <EmptyState
              image={personajePerfil}
              title={t`Sin personal asignado`}
              text={
                needle
                  ? t`Nadie coincide con la búsqueda.`
                  : t`Cuando Reclutamiento cubra tus requisiciones y haya turnos esta semana, tu personal aparece aquí.`
              }
            />
          ) : (
            <ul className={cn('flex flex-col gap-2', isFetching && 'opacity-70')}>
              {members.map((member) => (
                <li key={member.workerId}>
                  <Link
                    to={`/hotel/staff/${member.workerId}`}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 active:bg-surface-2"
                  >
                    <StaffAvatar member={member} className="size-11 text-base" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{member.fullName}</p>
                      <p className="truncate text-xs text-ink-3">{member.positionName ?? '—'}</p>
                      <TodayStatus member={member} />
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-ink-2">
                      <span
                        aria-hidden
                        className="size-2 rounded-full"
                        style={{ backgroundColor: stateColor(member.stateCode) }}
                      />
                      {stateLabel(member.stateCode)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
