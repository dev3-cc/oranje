import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  cn,
  MaterialIcon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import {
  useGetTimesheetDayStatusesQuery,
  useSetTimesheetDayStatusMutation,
} from '../api/timesheetApi'
import { addDaysIso, todayIso } from '../lib/weekNavigation'
import type {
  ManualPunchTarget,
  ReviewContext,
  TimesheetEntry,
  TimesheetPunch,
  TimesheetRow,
} from '../types/timesheet.types'

import { BulkApproveButton } from './BulkApproveButton'
import { DayStatusTour } from './DayStatusTour'
import { WeekActionBar } from './WeekActionBar'
import { WorkerWeekSummary } from './WorkerWeekSummary'

import { BackToListButton } from '@/shared/components/BackToListButton'
import { ListItemViewHint } from '@/shared/components/ListItemViewHint'
import { MagicCard } from '@/shared/components/MagicCard'
import { MetricCard } from '@/shared/components/MetricCard'
import { Button as MovingBorderBox } from '@/shared/components/MovingBorder'
import { PUNCH_STATE_LABEL, type PunchState } from '@/shared/constants/timesheetStatus'
import { useCan } from '@/shared/hooks/useCan'
import { rosterDetailClass, rosterListClass, useListDetail } from '@/shared/hooks/useListDetail'
import {
  formatDayMonth,
  formatHours,
  formatWeekday,
  formatWeekRange,
} from '@/shared/lib/formatters'

/** El mismo texto que ya usa `ReviewDayDialog` por cada marca del ponche. */
const PUNCH_TYPE_LABEL: Record<string, MessageDescriptor> = {
  CLOCK_IN: msg`Entrada`,
  LUNCH_OUT: msg`Salida a lunch`,
  LUNCH_IN: msg`Regreso de lunch`,
  CLOCK_OUT: msg`Salida`,
}

/**
 * El catálogo de Días sin ponches es del Administrador (D-36: un catálogo es
 * DATO, no se traduce) — pero Descanso/OFF son los dos sembrados de fábrica,
 * no texto libre de negocio, y Hugo los quiere en los dos idiomas
 * (2026-10-12). Lo que el Admin agregue DESPUÉS, sin código conocido aquí,
 * cae al nombre del catálogo tal cual — nunca se rompe, solo no traduce.
 */
const DAY_STATUS_LABEL: Record<string, MessageDescriptor> = {
  REST: msg`Descanso`,
  OFF: msg`OFF`,
}

/** `false`: "Aprobar todas" se oculta (Hugo, 2026-10-12) — el código se
    queda listo por si producción lo pide. */
const SHOW_BULK_APPROVE = false

/** Mismo contrato que ya usan `TimesheetGrid`/`TimesheetHoursView`: Asistencia
    no tenía forma de abrir la Revisión de un día observado — con Horas/Días
    ocultas (2026-10-10), una semana con una anomalía se quedaba sin cómo
    resolverla, y "Enviar y aprobar" seguía apagado sin que hubiera dónde
    arreglarlo (Hugo, 2026-10-12: "aprobar no sirve"). */
type ReviewHandler = (
  entry: TimesheetEntry,
  workerName: string,
  context: ReviewContext | undefined,
  manualPunchTarget: ManualPunchTarget,
) => void

/** Verde si está trabajando o completó el día, ámbar si falta un extremo,
    gris si el día no tiene marcas — mismo PunchState que ya usa el grid,
    visto aquí como una insignia en vez de un punto de color. */
const PUNCH_STATE_BADGE: Record<PunchState, string> = {
  COMPLETE: 'bg-green/10 text-green',
  IN_PROGRESS: 'bg-green/10 text-green',
  INCOMPLETE: 'bg-yellow/10 text-yellow',
  NO_SHIFT: 'border border-line text-ink-3',
}

function punchStateOf(row: TimesheetRow, today: string): PunchState {
  const todayEntry = row.entries.find((entry) => entry.date === today)
  return todayEntry?.punch ?? 'NO_SHIFT'
}

/**
 * Por qué el día quedó Observado — el badge solo decía "Observado" y ni Hugo
 * lo entendía viéndolo (2026-10-12). El servidor no manda un motivo
 * (`summarize()` en `timesheets.service.ts` solo da `hasAnomaly: boolean`),
 * así que se deriva aquí con la MISMA regla: sin entrada, sin salida, o
 * salida que no es después de la entrada — ahí es cuando `minutes <= 0`.
 */
function anomalyReason(entry: TimesheetEntry): MessageDescriptor {
  if (entry.startTime === null) return msg`Sin entrada registrada`
  if (entry.endTime === null) return msg`Sin salida registrada`
  if (entry.endTime <= entry.startTime) return msg`La salida no es después de la entrada`
  return msg`Anomalía sin resolver`
}

/** Cuál de las dos marcas es la que explica la anomalía — ahí va el resplandor,
    no en toda la fila (Hugo, 2026-10-12: "el botón debería llevarme a la
    anomalía"). Misma regla que `anomalyReason`. */
function anomalyPunchSide(entry: TimesheetEntry): 'start' | 'end' | null {
  if (entry.startTime === null) return 'start'
  if (entry.endTime === null) return 'end'
  if (entry.endTime <= entry.startTime) return 'end'
  return null
}

/** El "cometa" naranja de `MovingBorder` (Aceternity, vendoreado) — mismo que
    ya enciende el tramo de una requisición en `TimesheetGrid`. Envuelve SOLO
    la marca responsable de la anomalía, no tapa el pellet real (que pinta
    encima, `z-10`) ni bloquea su botón de corregir. */
function AnomalyGlow({ children }: { children: ReactNode }): ReactNode {
  return (
    <span className="relative inline-flex">
      <span className="pointer-events-none absolute -inset-1 z-0">
        <MovingBorderBox
          as="div"
          duration={3000}
          borderRadius="9999px"
          containerClassName="pointer-events-none h-full w-full p-[1.5px] text-base"
          borderClassName="h-[3px] w-8 rounded-full bg-[linear-gradient(90deg,transparent,#FF8000,transparent)] opacity-90"
          className="h-full w-full items-stretch justify-start border border-o-500/40 bg-transparent backdrop-blur-none"
        >
          <span />
        </MovingBorderBox>
      </span>
      <span className="relative z-10">{children}</span>
    </span>
  )
}

/**
 * Sin Schedule, un día sin ponches no deja fila: con qué se marca antes de
 * enviar a aprobación — Descanso, OFF… el catálogo lo da el Administrador
 * (Hugo, 2026-10-12). Solo el personal del hotel (`timesheet:review_punches`,
 * mismo alcance que corregir un ponche) puede elegirlo, y solo mientras la
 * semana sigue Abierta.
 */
function DayStatusPicker({
  timesheetId,
  workDate,
  dayStatus,
  editable,
}: {
  timesheetId: string
  workDate: string
  dayStatus: TimesheetEntry['dayStatus']
  editable: boolean
}): ReactNode {
  const { t, i18n } = useLingui()
  const can = useCan()
  const canSetDayStatus = can('timesheet:review_punches')
  const { data: statuses } = useGetTimesheetDayStatusesQuery(undefined, {
    skip: !canSetDayStatus || !editable,
  })
  const [setDayStatus, { isLoading }] = useSetTimesheetDayStatusMutation()

  if (dayStatus) {
    const label = DAY_STATUS_LABEL[dayStatus.code]
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2 py-0.5 text-xs text-ink-2">
        {label ? i18n._(label) : dayStatus.name}
        {editable && canSetDayStatus && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              void setDayStatus({ timesheetId, workDate, dayStatusId: null })
            }}
            aria-label={t`Quitar la marca`}
            title={t`Quitar la marca`}
            className="cursor-pointer text-ink-4 hover:text-ink-2"
          >
            <MaterialIcon name="close" className="text-sm" aria-hidden />
          </button>
        )}
      </span>
    )
  }

  if (!editable || !canSetDayStatus) {
    return <span className="text-xs text-ink-4">{t`Sin marcas`}</span>
  }

  return (
    <Select
      value=""
      disabled={isLoading}
      onValueChange={(value) => {
        void setDayStatus({ timesheetId, workDate, dayStatusId: value })
      }}
    >
      <SelectTrigger
        aria-label={t`Marcar el día`}
        className="h-7 w-fit gap-1.5 text-xs"
        data-tour="day-status-picker"
      >
        <SelectValue placeholder={t`Sin marcas · marcar`} />
      </SelectTrigger>
      <SelectContent>
        {(statuses ?? []).map((status) => {
          const label = DAY_STATUS_LABEL[status.code]
          return (
            <SelectItem key={status.id} value={status.id}>
              {label ? i18n._(label) : status.name}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
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
  onManualPunch,
  onCorrectPunch,
  onReview,
}: {
  rows: TimesheetRow[]
  selectedWeek: string
  /** Mismo botón que ya usa Días — enviar a revisión, marca manual, aprobar
      semana (todo vive en `WorkerWeekSummary`, reusado tal cual). */
  onManualPunch?: ((row: TimesheetRow) => void) | undefined
  /** Corregir UNA marca ya registrada (Manager de Área/General);
      `undefined` = el ícono no se dibuja. */
  onCorrectPunch?:
    ((target: { punch: TimesheetPunch; date: string; workerName: string }) => void) | undefined
  /** Abre la Revisión del día observado — sin esto, un día con anomalía
      bloqueaba "Enviar y aprobar" sin ninguna forma de resolverlo desde
      Asistencia. `undefined` = el aviso no se dibuja (p. ej. el Observador). */
  onReview?: ReviewHandler | undefined
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

  const listContent = (
    <>
      {/* Oculto por ahora (Hugo, 2026-10-12): competía con "Enviar y
          aprobar" de la tabla sin quedar claro que era OTRA acción — se
          queda el código listo, sin ruta para mostrarse, por si
          producción lo pide. */}
      {SHOW_BULK_APPROVE && <BulkApproveButton rows={rows} />}
      <ul className="flex flex-col gap-2">
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
    </>
  )

  const detailContent = selected && (
    <>
      <BackToListButton onClick={backToList} />
      {/* `key`: cada trabajador reinicia el chequeo — sin esto, el efecto
          solo corre al montar y si el primero visible no tenía día sin
          marcar, el tour nunca se disparaba al cambiar de fila. */}
      <DayStatusTour key={selected.timesheetId} />
      <AttendanceDetail
        row={selected}
        selectedWeek={selectedWeek}
        onManualPunch={onManualPunch}
        onCorrectPunch={onCorrectPunch}
        onReview={onReview}
      />
    </>
  )

  /* Revertido a `rosterListClass`/`rosterDetailClass` (Hugo, 2026-10-12): el
     intento de animar el swap con `position:absolute` dejó "Enviar y
     aprobar" sin responder en móvil — probablemente el quirk de CSS Grid
     con hijos en posición absoluta (su "grid area" de contención no es
     obvia). Correcto primero: ambos paneles montados siempre, CSS puro
     decide cuál se ve según el ancho, sin mover nada de sitio. La animación
     queda pendiente de retomar con más cuidado (y poder probarla en vivo). */
  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[300px_1fr]">
      <div className={cn('flex-col gap-3', rosterListClass(showDetailOnMobile))}>{listContent}</div>

      {detailContent && (
        <div
          className={cn(
            'flex-col gap-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-var(--hd)-3rem)] lg:overflow-y-auto',
            rosterDetailClass(showDetailOnMobile, 'lg', 'flex'),
          )}
        >
          {detailContent}
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
  const { t } = useLingui()
  /* La aureola del avatar dice si ESTA semana ya está aprobada — no el
     ponche de hoy, que es otra pregunta (Hugo, 2026-10-12). El color nunca
     va solo: palomita verde si aprobada, reloj gris si no. */
  const isApproved = row.weekStatus === 'APPROVED'

  return (
    <li>
      <MagicCard className="rounded-xl">
        <button
          type="button"
          onClick={onSelect}
          title={isApproved ? t`Semana aprobada` : t`Semana pendiente de aprobar`}
          className={cn(
            'flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
            isSelected ? 'border-o-500 bg-o-50' : 'border-line bg-surface hover:bg-surface-2',
          )}
        >
          <span className="relative inline-flex shrink-0">
            {row.photoUrl ? (
              <img
                src={row.photoUrl}
                alt=""
                className="size-11 rounded-xl object-cover ring-1 ring-line"
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <span
                aria-hidden
                className="flex size-11 items-center justify-center rounded-xl bg-o-500 text-sm font-bold text-ink ring-1 ring-line"
              >
                {row.workerName.charAt(0)}
              </span>
            )}
            <span
              aria-hidden
              className={cn(
                'absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border-2',
                isApproved
                  ? 'border-surface bg-green text-surface'
                  : 'border-surface bg-ink-4 text-surface',
              )}
            >
              <MaterialIcon
                name={isApproved ? 'check' : 'schedule'}
                className="text-[11px]"
                aria-hidden
              />
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{row.workerName}</span>
            <span className="block truncate text-xs text-ink-3">
              {row.jobTitle} · {row.hotelName}
            </span>
          </span>
          <ListItemViewHint />
        </button>
      </MagicCard>
    </li>
  )
}

function AttendanceDetail({
  row,
  selectedWeek,
  onManualPunch,
  onCorrectPunch,
  onReview,
}: {
  row: TimesheetRow
  selectedWeek: string
  onManualPunch?: ((row: TimesheetRow) => void) | undefined
  onCorrectPunch?:
    ((target: { punch: TimesheetPunch; date: string; workerName: string }) => void) | undefined
  onReview?: ReviewHandler | undefined
}): ReactNode {
  const { t, i18n } = useLingui()
  const today = todayIso()
  /* "Hoy" solo tiene sentido dentro de la semana que lo contiene — si no, el
     badge seguía diciendo "Hoy" al navegar a una semana pasada aunque esos
     días no traían el de hoy (Hugo, 2026-10-12: "a pesar que voy atrás sigue
     diciendo today"). */
  const isCurrentWeek = selectedWeek <= today && today <= addDaysIso(selectedWeek, 6)
  const punchState = punchStateOf(row, today)

  /* Una vez enviada a aprobación (u aprobada), el hotel ya no corrige nada —
     lo pide Hugo (2026-10-12): se congela, y si algo quedó mal se resuelve
     con Oranje. El lápiz ni se dibuja; el servidor además lo rechaza
     (`TIMESHEET_ALREADY_SENT`) si alguien lo intenta por otra vía. */
  const editableCorrectPunch = row.weekStatus === 'OPEN' ? onCorrectPunch : undefined

  // Por día, el día más reciente primero y dentro de cada uno en el orden
  // real en que ocurrieron (Entrada → lunch → Salida) — antes era una lista
  // plana que repetía la fecha en cada renglón (Hugo, 2026-10-10).
  const activityByDay = [...row.entries]
    .filter((entry) => entry.punches.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((entry) => ({
      date: entry.date,
      punches: [...entry.punches].sort((a, b) => a.serverTime.localeCompare(b.serverTime)),
    }))

  return (
    <>
      {/* Identidad y estado, sin botones aquí: el `WeekActionBar` vive junto
          a la tabla de días de abajo — es ahí donde se revisan las horas
          antes de decidir (Hugo, 2026-10-10: "que el botón esté en la
          tabla"). Un solo botón, no dos copias repitiendo la misma acción. */}
      <WorkerWeekSummary
        row={row}
        photoUrl={row.photoUrl}
        onManualPunch={onManualPunch}
        showActions={false}
      />

      {isCurrentWeek && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5">
          <span className="text-sm text-ink-3">
            <Trans>Hoy</Trans>
          </span>
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
      )}

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
          value={row.overtimeHours !== null ? formatHours(row.overtimeHours) : '—'}
          foot={row.overtimeHours === null ? t`aún sin calcular` : t`sobre 40 h por requisición`}
        />
      </div>

      <section className="flex flex-col gap-3">
        {/* Header de la tabla: título a la izquierda, la acción primaria a la
            derecha, dentro del MISMO marco que la tabla — no en una tarjeta
            aparte arriba (Hugo, 2026-10-10: "que el botón esté en la
            tabla"). Mismo `WeekActionBar` que la tarjeta de resumen: una
            sola lógica, dos lugares donde tiene sentido verla. */}
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="text-lg font-semibold text-ink">
              <Trans>Semana del {formatWeekRange(selectedWeek, addDaysIso(selectedWeek, 6))}</Trans>
            </h2>
            {/* Sin marca manual aquí: con el lápiz de "Corregir" en cada
                celda de la tabla ya se edita directamente (Hugo,
                2026-10-12) — el diálogo aparte sobraba. */}
            <WeekActionBar row={row} />
          </div>
          <div className="overflow-x-auto">
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
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {row.entries.map((entry) => (
                  <AttendanceDayRow
                    key={entry.id}
                    entry={entry}
                    row={row}
                    onCorrectPunch={editableCorrectPunch}
                    onReview={onReview}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ink">
          <Trans>Actividad</Trans>
        </h2>
        {activityByDay.length === 0 ? (
          <p className="text-sm text-ink-3">
            <Trans>Sin marcas esta semana.</Trans>
          </p>
        ) : (
          activityByDay.map((day) => (
            <div key={day.date} className="flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold text-ink-2">
                {formatWeekday(day.date)} · {formatDayMonth(day.date)}
              </h3>
              <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
                {day.punches.map((punch) => {
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
                      <span className="shrink-0 text-xs text-ink-3">{punch.serverTime}</span>
                      {editableCorrectPunch && (
                        <button
                          type="button"
                          onClick={() => {
                            editableCorrectPunch({
                              punch,
                              date: day.date,
                              workerName: row.workerName,
                            })
                          }}
                          aria-label={t`Corregir esta marca`}
                          title={t`Corregir esta marca`}
                          className="shrink-0 cursor-pointer rounded p-1 text-ink-4 hover:bg-surface-2 hover:text-ink-2"
                        >
                          <MaterialIcon name="edit" className="text-base" aria-hidden />
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))
        )}
      </section>
    </>
  )
}

function AttendanceDayRow({
  entry,
  row,
  onCorrectPunch,
  onReview,
}: {
  entry: TimesheetEntry
  row: TimesheetRow
  onCorrectPunch?:
    ((target: { punch: TimesheetPunch; date: string; workerName: string }) => void) | undefined
  onReview?: ReviewHandler | undefined
}): ReactNode {
  const { t, i18n } = useLingui()
  const workerName = row.workerName
  const clockIn = entry.punches.find((punch) => punch.type === 'CLOCK_IN')
  const clockOut = entry.punches.find((punch) => punch.type === 'CLOCK_OUT')
  const anomalySide = entry.hasAnomaly ? anomalyPunchSide(entry) : null

  return (
    <tr>
      <td className="px-4 py-3 text-ink">
        {/* Día de la semana, no solo la fecha — Hugo, 2026-10-10. */}
        <span className="font-semibold">{formatWeekday(entry.date)}</span>{' '}
        <span className="text-ink-3">{formatDayMonth(entry.date)}</span>
      </td>
      <td className="px-4 py-3">
        {entry.startTime || entry.endTime ? (
          <span className="flex flex-wrap items-center gap-1 text-ink-2">
            {(() => {
              if (entry.continuesFromPreviousDay) {
                // No es un "—" rojo de "falta algo": este lado del turno
                // ocurrió ayer (Hugo, 2026-10-12, D-?? overnight).
                return (
                  <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2 py-0.5 text-xs text-ink-3">
                    <MaterialIcon name="dark_mode" className="text-sm" aria-hidden />
                    <Trans>Viene del día anterior</Trans>
                  </span>
                )
              }
              const pill = (
                <span className="inline-flex items-center gap-1 rounded-full bg-green/10 px-2 py-0.5 text-xs text-green">
                  <MaterialIcon name="login" className="text-sm" aria-hidden />
                  {entry.startTime ?? '—'}
                </span>
              )
              return anomalySide === 'start' ? <AnomalyGlow>{pill}</AnomalyGlow> : pill
            })()}
            {onCorrectPunch && clockIn && (
              <button
                type="button"
                onClick={() => {
                  onCorrectPunch({ punch: clockIn, date: entry.date, workerName })
                }}
                aria-label={t`Corregir la entrada`}
                title={t`Corregir la entrada`}
                className="cursor-pointer rounded p-1 text-ink-4 hover:bg-surface-2 hover:text-ink-2"
              >
                <MaterialIcon name="edit" className="text-sm" aria-hidden />
              </button>
            )}
            {(() => {
              if (entry.continuesNextDay) {
                return (
                  <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2 py-0.5 text-xs text-ink-3">
                    <MaterialIcon name="dark_mode" className="text-sm" aria-hidden />
                    <Trans>Continúa al día siguiente</Trans>
                  </span>
                )
              }
              const pill = (
                <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-red/10 px-2 py-0.5 text-xs text-red">
                  <MaterialIcon name="logout" className="text-sm" aria-hidden />
                  {entry.endTime ?? '—'}
                </span>
              )
              return anomalySide === 'end' ? <AnomalyGlow>{pill}</AnomalyGlow> : pill
            })()}
            {onCorrectPunch && clockOut && (
              <button
                type="button"
                onClick={() => {
                  onCorrectPunch({ punch: clockOut, date: entry.date, workerName })
                }}
                aria-label={t`Corregir la salida`}
                title={t`Corregir la salida`}
                className="cursor-pointer rounded p-1 text-ink-4 hover:bg-surface-2 hover:text-ink-2"
              >
                <MaterialIcon name="edit" className="text-sm" aria-hidden />
              </button>
            )}
          </span>
        ) : entry.isAbsence ? (
          <span className="text-xs text-ink-4">{t`Falta`}</span>
        ) : (
          <DayStatusPicker
            timesheetId={row.timesheetId}
            workDate={entry.date}
            dayStatus={entry.dayStatus}
            editable={row.weekStatus === 'OPEN'}
          />
        )}
        {entry.hasAnomaly && onReview && (
          /* Sin esto, un día Observado bloqueaba "Enviar y aprobar" sin
             ninguna forma de resolverlo desde Asistencia — Horas/Días, donde
             vivía la Revisión, están ocultas (Hugo, 2026-10-12: "aprobar no
             sirve"). Abre el mismo diálogo que usaban esas vistas. */
          <button
            type="button"
            onClick={() => {
              onReview(
                entry,
                workerName,
                {
                  workerPhotoUrl: null,
                  jobTitle: row.jobTitle,
                  hotelName: row.hotelName,
                  hotelPhotoUrl: null,
                },
                {
                  requisitionId: row.requisitionId,
                  workerId: row.workerId,
                  workerName: row.workerName,
                  entries: row.entries,
                },
              )
            }}
            className="mt-1.5 flex cursor-pointer items-center gap-1 rounded-md bg-yellow/10 px-2 py-0.5 text-xs font-semibold text-yellow hover:bg-yellow/20"
          >
            <MaterialIcon name="warning_amber" className="text-sm" aria-hidden />
            {i18n._(anomalyReason(entry))} · <Trans>Revisar</Trans>
          </button>
        )}
      </td>
      <td className="px-4 py-3 font-semibold text-ink">
        {entry.hours !== null ? formatHours(entry.hours) : '—'}
      </td>
    </tr>
  )
}
