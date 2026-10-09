import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { cn, MaterialIcon } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import type { TimesheetEntry, TimesheetRow } from '../types/timesheet.types'

import { BackToListButton } from '@/shared/components/BackToListButton'
import { MagicCard } from '@/shared/components/MagicCard'
import { MetricCard } from '@/shared/components/MetricCard'
import { PUNCH_STATE_LABEL, type PunchState } from '@/shared/constants/timesheetStatus'
import { rosterDetailClass, rosterListClass, useListDetail } from '@/shared/hooks/useListDetail'
import { formatDate, formatDayMonth, formatHours } from '@/shared/lib/formatters'

/** El mismo texto que ya usa `ReviewDayDialog` por cada marca del ponche. */
const PUNCH_TYPE_LABEL: Record<string, MessageDescriptor> = {
  CLOCK_IN: msg`Entrada`,
  LUNCH_OUT: msg`Salida a lunch`,
  LUNCH_IN: msg`Regreso de lunch`,
  CLOCK_OUT: msg`Salida`,
}

/** Verde si está trabajando o completó el día, ámbar si falta un extremo,
    gris si el día no tiene marcas — mismo PunchState que ya usa el grid,
    visto aquí como una insignia en vez de un punto de color. */
const PUNCH_STATE_BADGE: Record<PunchState, string> = {
  COMPLETE: 'bg-green/10 text-green',
  IN_PROGRESS: 'bg-green/10 text-green',
  INCOMPLETE: 'bg-yellow/10 text-yellow',
  NO_SHIFT: 'border border-line text-ink-3',
}

/** El mismo estado, como punto de color — para el punto de la lista. */
const PUNCH_STATE_DOT: Record<PunchState, string> = {
  COMPLETE: 'var(--green)',
  IN_PROGRESS: 'var(--green)',
  INCOMPLETE: 'var(--yellow)',
  NO_SHIFT: 'var(--ink-4)',
}

function punchStateOf(row: TimesheetRow): PunchState {
  const today = new Date().toISOString().slice(0, 10)
  const todayEntry = row.entries.find((entry) => entry.date === today)
  return todayEntry?.punch ?? 'NO_SHIFT'
}

/**
 * Vista alterna del Timesheet, por colaborador (Hugo, 2026-10-09): no es otra
 * pantalla — es una densidad más, junto a Horas/Días/Mes, con su misma pastilla
 * de conmutador. Lista a la izquierda (patrón de Mi Personal/Mi Equipo,
 * `useListDetail` — no el Sidebar de la app, que es la navegación general),
 * detalle a la derecha. Mismos datos que ya trae `week`, sin pedir nada nuevo.
 */
export function AttendanceView({
  rows,
  selectedWeek,
}: {
  rows: TimesheetRow[]
  selectedWeek: string
}): ReactNode {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { showDetailOnMobile, select, backToList } = useListDetail()

  const selected = rows.find((item) => item.workerId === selectedId) ?? rows[0] ?? null

  /* Si cambia de semana y quien estaba elegido ya no aparece (sin Timesheet
     esa semana), se cae al primero — nunca una pantalla a medias. */
  useEffect(() => {
    if (selectedId !== null && !rows.some((row) => row.workerId === selectedId)) {
      setSelectedId(null)
    }
  }, [rows, selectedId])

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
        <Trans>Sin Timesheets esta semana.</Trans>
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[300px_1fr]">
      <ul className={cn('flex-col gap-2', rosterListClass(showDetailOnMobile))}>
        {rows.map((row) => (
          <WorkerListItem
            key={row.workerId}
            row={row}
            isSelected={row.workerId === selected?.workerId}
            onSelect={() => {
              setSelectedId(row.workerId)
              select()
            }}
          />
        ))}
      </ul>

      {selected && (
        <div className={cn('flex-col gap-6', rosterDetailClass(showDetailOnMobile, 'lg', 'flex'))}>
          <BackToListButton onClick={backToList} />
          <AttendanceDetail row={selected} selectedWeek={selectedWeek} />
        </div>
      )}
    </div>
  )
}

function WorkerListItem({
  row,
  isSelected,
  onSelect,
}: {
  row: TimesheetRow
  isSelected: boolean
  onSelect: () => void
}): ReactNode {
  const punchState = punchStateOf(row)

  return (
    <li>
      <MagicCard className="rounded-xl">
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            'flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
            isSelected ? 'border-o-500 bg-o-50' : 'border-line bg-surface hover:bg-surface-2',
          )}
        >
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-o-500 text-sm font-bold text-ink ring-1 ring-line"
          >
            {row.workerName.charAt(0)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{row.workerName}</span>
            <span className="block truncate text-xs text-ink-3">
              {row.jobTitle} · {row.hotelName}
            </span>
          </span>
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: PUNCH_STATE_DOT[punchState] }}
          />
        </button>
      </MagicCard>
    </li>
  )
}

function AttendanceDetail({
  row,
  selectedWeek,
}: {
  row: TimesheetRow
  selectedWeek: string
}): ReactNode {
  const { t, i18n } = useLingui()
  const punchState = punchStateOf(row)

  /* «Horas negativas» se quitó (Hugo, 2026-10-09): sin horas contractuales
     casi siempre, el dato salía en «—» para casi todos y no decía nada. */
  const overtime = row.targetHours !== null ? Math.max(row.totalHours - row.targetHours, 0) : null

  // Todas las marcas de la semana, de la más reciente a la más vieja —
  // el mismo dato que ya trae cada `entry.punches`, solo aplanado.
  const activity = row.entries
    .flatMap((entry) =>
      entry.punches.map((punch) => ({ ...punch, date: entry.date, dayId: entry.id })),
    )
    .sort((a, b) => `${b.date}T${b.serverTime}`.localeCompare(`${a.date}T${a.serverTime}`))

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-o-500 text-lg font-bold text-ink ring-1 ring-line"
          >
            {row.workerName.charAt(0)}
          </span>
          <div>
            <p className="text-lg font-bold text-ink">{row.workerName}</p>
            <p className="text-sm text-ink-3">
              {row.jobTitle} · {row.hotelName}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
            PUNCH_STATE_BADGE[punchState],
          )}
        >
          <MaterialIcon name="fiber_manual_record" className="text-[10px]" aria-hidden />
          {PUNCH_STATE_LABEL[punchState]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard
          icon="calendar_month"
          label={t`Horas por semana`}
          value={row.targetHours !== null ? formatHours(row.targetHours) : '—'}
          foot={t`lo que marca el contrato`}
        />
        <MetricCard
          icon="schedule"
          label={t`Trabajadas esta semana`}
          value={formatHours(row.totalHours)}
          foot={t`suma de los días con marcas`}
        />
        <MetricCard
          icon="trending_up"
          label={t`Horas extra esta semana`}
          value={overtime !== null ? formatHours(overtime) : '—'}
          foot={
            overtime === null
              ? t`sin horas contractuales, no se puede estimar`
              : t`sobre lo contractual`
          }
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">
          <Trans>Semana del {formatDate(selectedWeek)}</Trans>
        </h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th className="px-4 py-2.5 font-medium">
                  <Trans>Fecha</Trans>
                </th>
                <th className="px-4 py-2.5 font-medium">
                  <Trans>Marcas</Trans>
                </th>
                <th className="px-4 py-2.5 font-medium">
                  <Trans>Horas netas</Trans>
                </th>
                <th className="px-4 py-2.5 font-medium">
                  <Trans>Estado</Trans>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {row.entries.map((entry) => (
                <AttendanceDayRow key={entry.id} entry={entry} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">
          <Trans>Actividad</Trans>
        </h2>
        {activity.length === 0 ? (
          <p className="text-sm text-ink-3">
            <Trans>Sin marcas esta semana.</Trans>
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {activity.map((punch) => {
              const typeLabel = PUNCH_TYPE_LABEL[punch.type]

              return (
                <li key={punch.id} className="flex items-center gap-3 px-4 py-3">
                  <MaterialIcon
                    name={punch.type === 'CLOCK_OUT' ? 'logout' : 'login'}
                    className="shrink-0 text-base text-ink-4"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 text-sm text-ink">
                    {typeLabel ? i18n._(typeLabel) : punch.type}
                    {punch.isManual && (
                      <span className="ml-1.5 text-xs text-ink-3">
                        <Trans>· marca manual</Trans>
                      </span>
                    )}
                    {punch.insideGeofence === false && (
                      <span className="ml-1.5 text-xs text-red">
                        <Trans>· fuera de geocerca</Trans>
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-ink-3">
                    {formatDayMonth(punch.date)} · {punch.serverTime}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}

function AttendanceDayRow({ entry }: { entry: TimesheetEntry }): ReactNode {
  const { t } = useLingui()

  return (
    <tr>
      <td className="px-4 py-3 text-ink">{formatDayMonth(entry.date)}</td>
      <td className="px-4 py-3">
        {entry.startTime || entry.endTime ? (
          <span className="flex items-center gap-2 text-ink-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-green/10 px-2 py-0.5 text-xs text-green">
              <MaterialIcon name="login" className="text-sm" aria-hidden />
              {entry.startTime ?? '—'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-red/10 px-2 py-0.5 text-xs text-red">
              <MaterialIcon name="logout" className="text-sm" aria-hidden />
              {entry.endTime ?? '—'}
            </span>
          </span>
        ) : (
          <span className="text-xs text-ink-4">{entry.isAbsence ? t`Falta` : t`Sin marcas`}</span>
        )}
      </td>
      <td className="px-4 py-3 font-semibold text-ink">
        {entry.hours !== null ? formatHours(entry.hours) : '—'}
      </td>
      <td className="px-4 py-3">
        <span className={cn('text-xs', entry.hasAnomaly ? 'text-yellow' : 'text-ink-3')}>
          {entry.hasAnomaly ? t`Observado` : entry.reviewNote ? t`Revisado` : t`Pendiente`}
        </span>
      </td>
    </tr>
  )
}
