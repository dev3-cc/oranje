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
  Skeleton,
} from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import {
  useGetTimesheetDayStatusesQuery,
  useSetTimesheetDayStatusMutation,
} from '../api/timesheetApi'
import { addDaysIso } from '../lib/weekNavigation'
import type {
  ManualPunchTarget,
  ReviewContext,
  TimesheetEntry,
  TimesheetPunch,
  TimesheetRow,
} from '../types/timesheet.types'

import { BulkApproveButton } from './BulkApproveButton'
import { DayStatusTour } from './DayStatusTour'
import { PayPreviewBadge } from './PayPreviewBadge'
import { WeekActionBar } from './WeekActionBar'
import { WorkerWeekSummary } from './WorkerWeekSummary'

import { ConsolidationPayStatus, type PayOverrideTarget } from '@/features/accounting'
import type { PayAdjustment } from '@/features/recruitment'
import { BackToListButton } from '@/shared/components/BackToListButton'
import { ListItemViewHint } from '@/shared/components/ListItemViewHint'
import { MagicCard } from '@/shared/components/MagicCard'
import { MetricCard } from '@/shared/components/MetricCard'
import { Button as MovingBorderBox } from '@/shared/components/MovingBorder'
import { NO_TIMESHEET_STATUS } from '@/shared/constants/timesheetStatus'
import { useCan } from '@/shared/hooks/useCan'
import { rosterDetailClass, rosterListClass, useListDetail } from '@/shared/hooks/useListDetail'
import {
  formatDayMonth,
  formatHours,
  formatMoney,
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
  pendingAdjustments = [],
  isRecalculatingLunch = false,
  onCorrectOvertime,
}: {
  rows: TimesheetRow[]
  selectedWeek: string
  /** Aprobados por el Observador, sin decidir si pesan en la nómina — se
      filtran por persona para el `PayPreviewBadge` de cada ficha (Hugo,
      2026-10-14). Vacío sin `payroll:generate`: a nadie más se le dibuja. */
  pendingAdjustments?: PayAdjustment[]
  /** Se está recalculando el lonche de ESTE hotel — un skeleton solo en las
      celdas de dinero/horas, no en toda la tabla (Hugo, 2026-10-15: "no que
      se ponga en toda la tabla el skeleton"). */
  isRecalculatingLunch?: boolean
  /** Abre la corrección de tarifa/reparto de horas de ESA hoja — el hotel
      puede llamar a Oranje a pedir que se corrija (Hugo, 2026-10-15).
      `undefined` sin `payroll:generate`: a nadie más se le dibuja el lápiz. */
  onCorrectOvertime?: ((target: PayOverrideTarget) => void) | undefined
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
  /* Arriba de todo (lista Y detalle), no solo de las tarjetas — "que eso de
     semana cerrada sea lo que vean primero" (Hugo, 2026-10-15, segunda
     vuelta: la capa de abajo solo cubría las tarjetas y no bastaba). */
  const isFrozen =
    selected?.weekStatus === 'PENDING_APPROVAL' || selected?.weekStatus === 'APPROVED'

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
        pendingAdjustments={pendingAdjustments.filter(
          (adjustment) => adjustment.worker.id === selected.workerId,
        )}
        isRecalculatingLunch={isRecalculatingLunch}
        onCorrectOvertime={onCorrectOvertime}
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
    <div className="relative">
      <div
        className={cn(
          'grid grid-cols-1 items-start gap-5 lg:grid-cols-[300px_1fr]',
          isFrozen && 'grayscale',
        )}
      >
        <div className={cn('flex-col gap-3', rosterListClass(showDetailOnMobile))}>
          {listContent}
        </div>

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

      {/* El div gris CUBRE lista y detalle a la vez — no solo las tarjetas
          de arriba, no solo la tabla — para que "semana cerrada" sea lo
          primero que se ve al entrar, antes de leer un solo dato (Hugo,
          2026-10-15, segunda vuelta: "que cubra la lista y el detalle").
          `pointer-events-none`: decorativa, no un candado real — elegir a
          otro colaborador en la lista y "Corregir" en la tabla siguen
          funcionando debajo; una semana cerrada sigue siendo revisable,
          solo deja de recalcularse sola. El texto va arriba (`items-start`)
          porque es la mitad de la pantalla que se ve sin scroll al entrar. */}
      {isFrozen && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center bg-ink-4/20 pt-8"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/90 px-4 py-2 text-sm font-bold text-white shadow-lg">
            <MaterialIcon name="lock" className="text-base" aria-hidden />
            <Trans>Semana cerrada</Trans>
          </span>
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
            isSelected
              ? 'border-o-500 bg-o-50'
              : // El borde de la fila, no solo la palomita diminuta del avatar —
                // a simple vista, sin acercarse (Hugo, 2026-10-15: "con margen
                // verde... por qué no veo el cambio" — `/50` en 1px no se
                // notaba contra el fondo crema; ahora es grueso y sólido).
                cn(
                  'bg-surface hover:bg-surface-2',
                  isApproved ? 'border-2 border-green' : 'border-line',
                ),
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
              {/* Mismo criterio que la ficha: sin puesto en el catálogo, no
                  se pinta el "— ·" (Hugo, 2026-10-15). */}
              {row.jobTitle !== '—' ? `${row.jobTitle} · ` : ''}
              {row.hotelName}
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
  pendingAdjustments,
  isRecalculatingLunch,
  onCorrectOvertime,
}: {
  row: TimesheetRow
  selectedWeek: string
  onManualPunch?: ((row: TimesheetRow) => void) | undefined
  onCorrectPunch?:
    ((target: { punch: TimesheetPunch; date: string; workerName: string }) => void) | undefined
  onReview?: ReviewHandler | undefined
  pendingAdjustments: PayAdjustment[]
  isRecalculatingLunch: boolean
  onCorrectOvertime?: ((target: PayOverrideTarget) => void) | undefined
}): ReactNode {
  const { t, i18n } = useLingui()
  const [isActivityOpen, setIsActivityOpen] = useState(true)

  /* Una vez enviada a aprobación (u aprobada), el hotel ya no corrige nada —
     lo pide Hugo (2026-10-12): se congela, y si algo quedó mal se resuelve
     con Oranje. El lápiz ni se dibuja; el servidor además lo rechaza
     (`TIMESHEET_ALREADY_SENT`) si alguien lo intenta por otra vía. */
  const editableCorrectPunch = row.weekStatus === 'OPEN' ? onCorrectPunch : undefined

  /* Misma condición que ya congela el lápiz arriba — Hugo no sabía si
     estaba viendo una semana cerrada con solo el badge de otra parte de la
     pantalla (2026-10-15: "no sé si estoy en una semana ya cerrada"). La
     tabla misma lo avisa ahora: nunca solo color (regla de la skill de UX),
     tinte + borde + ícono + texto juntos. */
  const isFrozen = row.weekStatus === 'PENDING_APPROVAL' || row.weekStatus === 'APPROVED'

  /* Mismo criterio que la píldora de arriba (`PayPreviewBadge`): con
     descuentos ya incluidos, el total es el NETO — lo que de verdad recibe
     el colaborador —, si no, el bruto. `null` sin contrato ni rate interno
     que resolver (no se inventa un total). */
  const weekTotal = (() => {
    const preview = row.payPreview
    if (!preview || preview.subtotal === null) return null
    const hasDeduction = preview.deductionAmount !== '0' && preview.deductionAmount !== '0.00'
    return Number(hasDeduction && preview.netAmount !== null ? preview.netAmount : preview.subtotal)
  })()

  /* Lo que sale del 1.5× — misma fórmula exacta del servidor
     (`timesheets.repository.ts payPreview()`: overtimeMinutes/60 * payRate *
     overtimeMultiplier), no una aproximación: suma centavo a centavo con el
     Total de arriba (Hugo, 2026-10-15: "el overtime, ¿es el 1.5 de extra?"). */
  const overtime = (() => {
    const preview = row.payPreview
    if (
      !preview ||
      preview.overtimeMinutes <= 0 ||
      preview.payRate === null ||
      preview.overtimeMultiplier === null
    ) {
      return null
    }
    return {
      hours: preview.overtimeMinutes / 60,
      multiplier: preview.overtimeMultiplier,
      amount: (preview.overtimeMinutes / 60) * Number(preview.payRate) * preview.overtimeMultiplier,
    }
  })()

  /* "Trabajadas esta semana" ya es NETA (D-33: el hotel que no paga lonche
     resta el descanso) — mostrarla sola, sin decir que ya tiene un descuento
     adentro, se lee como si fueran las horas crudas (Hugo, 2026-10-15: "si
     trabajaba 19 horas... no es del todo real"). Minutos de lonche de la
     semana completa, sumando los de cada día — para poner al lado cuánto
     era ANTES de restarlo. */
  const weekLunchMinutes = row.entries.reduce((sum, entry) => sum + entry.lunchDeductionMinutes, 0)

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
      {/* Dice de quién es la ficha antes de la tarjeta misma — con varias
          personas en la lista no quedaba claro cuál se estaba viendo sin
          leer el nombre adentro (Hugo, 2026-10-15: "pon el texto Ahora
          viendo a"). */}
      <p className="text-sm text-ink-3">
        <Trans>Ahora viendo a {row.workerName}</Trans>
      </p>

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

      {/* El tinte gris y el aviso "Semana cerrada" ya viven en `AttendanceView`
          (cubren lista y detalle de una vez, Hugo 2026-10-15) — no se
          repiten aquí para no doblar el mismo aviso dos veces. */}
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
          foot={
            weekLunchMinutes > 0
              ? t`${formatHours(row.totalHours + weekLunchMinutes / 60)} antes del lonche (-${weekLunchMinutes} min)`
              : t`suma de los días con marcas`
          }
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
        <div
          className={cn(
            'overflow-hidden rounded-lg border',
            // La tabla misma avisa que está congelada — antes solo lo decía
            // una insignia en otra parte de la pantalla, y con la tabla
            // sola a la vista no quedaba claro (Hugo, 2026-10-15: "no sé si
            // estoy en una semana ya cerrada... una capa de semana
            // cerrada"). Nunca solo color (regla de la skill de UX):
            // tinte + borde + ícono + texto, los cuatro juntos.
            isFrozen ? 'border-ink-4/40 bg-surface-2' : 'border-line bg-surface',
          )}
        >
          {isFrozen && (
            <div className="flex items-center gap-1.5 border-b border-ink-4/40 bg-ink-4/10 px-4 py-2 text-xs font-semibold text-ink-3">
              <MaterialIcon name="lock" className="text-sm" aria-hidden />
              <Trans>
                Semana cerrada — estos valores no cambian aunque ajustes el lonche del hotel.
              </Trans>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="text-lg font-semibold text-ink">
              <Trans>Semana del {formatWeekRange(selectedWeek, addDaysIso(selectedWeek, 6))}</Trans>
            </h2>
            {/* Sin marca manual aquí para un timesheet YA existente: con el
                lápiz de "Corregir" en cada celda ya se edita directamente
                (Hugo, 2026-10-12). Pero sin timesheet (nunca ponchó) no hay
                ninguna celda que corregir, y sin esto no había forma de
                darle su PRIMERA marca (Hugo, 2026-10-14, encontrado
                probando el flujo en vivo). */}
            <div className="flex flex-wrap items-center gap-2">
              <WeekActionBar
                row={row}
                onManualPunch={row.weekStatus === NO_TIMESHEET_STATUS ? onManualPunch : undefined}
              />
              {/* Solo Contabilidad: nadie más tiene `payroll:mark_paid`, así
                  que a nadie más se le dibuja nada aquí (Hugo, 2026-10-14). */}
              <ConsolidationPayStatus row={row} selectedWeek={selectedWeek} />
            </div>
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
                  {/* Las tres columnas de dinero/horas alineadas a la derecha
                      de punta a punta — cabecera, filas y el Total del pie—
                      para que se lean como lo que son, una multiplicación en
                      columna (Hugo, 2026-10-15: "está descuadrado el total",
                      la del pie ya alineaba a la derecha, las de arriba no). */}
                  <th className="px-4 py-2.5 text-right font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <Trans>Horas netas</Trans>
                      {/* Junto a Horas netas, no en otro lado: Contabilidad
                          necesita saber cuánto antes de generar el
                          Consolidado (Hugo, 2026-10-14). */}
                      <PayPreviewBadge
                        payPreview={row.payPreview}
                        approvedAt={row.approvedAt}
                        pendingAdjustments={pendingAdjustments}
                        isRecalculating={isRecalculatingLunch}
                      />
                    </div>
                  </th>
                  {/* Columna aparte del resumen de arriba: el número crudo a
                      multiplicar, sin tooltip de por medio (Hugo, 2026-10-15,
                      "no resumido"). Es la tarifa de la SEMANA — la misma en
                      cada fila, del contrato o del rate interno. */}
                  <th className="px-4 py-2.5 text-right font-medium">
                    <Trans>Tarifa/h</Trans>
                  </th>
                  {/* La multiplicación misma, no solo sus dos factores — de
                      dónde sale el Total de abajo, sin tener que calcularlo
                      a mano (Hugo, 2026-10-15: "de donde saca los 128"). */}
                  <th className="px-4 py-2.5 text-right font-medium">
                    <Trans>Pago del día</Trans>
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
                    isRecalculatingLunch={isRecalculatingLunch}
                  />
                ))}
              </tbody>
              {/* El total de la semana, abajo a la derecha — no solo en la
                  píldora de arriba (Hugo, 2026-10-15). Mismo criterio que
                  `PayPreviewBadge`: con descuentos ya incluidos manda el
                  NETO, que es lo que de verdad recibe el colaborador. */}
              {weekTotal !== null && (
                <tfoot>
                  <tr className="border-t border-line bg-surface-2">
                    <td colSpan={4} className="px-4 py-3 text-right text-sm text-ink-3">
                      <Trans>Total de la semana</Trans>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">
                      {isRecalculatingLunch ? (
                        <Skeleton className="ml-auto h-4 w-16" />
                      ) : (
                        formatMoney(weekTotal)
                      )}
                    </td>
                  </tr>
                  {/* Debajo del Total, no arriba — y diciendo "ya incluido",
                      no solo "incluye", para que no quede la duda de si se
                      suma aparte (Hugo, 2026-10-15: "no sé si ya lo está
                      sumando... póngalo debajo del total"). El 1.5× ya está
                      adentro del número de arriba; esta línea solo
                      desglosa cuánto de eso es la parte extra. */}
                  {overtime !== null && (
                    <tr className="border-t border-line">
                      <td colSpan={4} className="px-4 py-2 text-right text-xs text-ink-3">
                        <span className="inline-flex items-center justify-end gap-1.5">
                          <Trans>
                            Ya incluye {formatHours(overtime.hours)} de extra, pagadas a{' '}
                            {overtime.multiplier}×
                          </Trans>
                          {/* El hotel puede llamar a Oranje a pedir que se
                              corrija — sin esto no había cómo, desde aquí, sin
                              ir a Timesheet Global (Hugo, 2026-10-15: "un
                              lápiz para editar"). */}
                          {onCorrectOvertime && row.payPreview && (
                            <button
                              type="button"
                              onClick={() => {
                                const preview = row.payPreview
                                if (!preview) return
                                onCorrectOvertime({
                                  timesheetId: row.timesheetId,
                                  workerName: row.workerName,
                                  regularMinutes: preview.regularMinutes,
                                  overtimeMinutes: preview.overtimeMinutes,
                                  payRate: preview.payRate,
                                  isOverridden: preview.isOverridden,
                                  overrideReason: preview.overrideReason,
                                })
                              }}
                              aria-label={t`Corregir horas extra de ${row.workerName}`}
                              title={t`Corregir horas extra`}
                              className="cursor-pointer rounded p-0.5 text-ink-4 hover:bg-surface-2 hover:text-o-700"
                            >
                              <MaterialIcon name="edit" className="text-sm" aria-hidden />
                            </button>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-ink-3">
                        {isRecalculatingLunch ? (
                          <Skeleton className="ml-auto h-4 w-14" />
                        ) : (
                          formatMoney(overtime.amount)
                        )}
                      </td>
                    </tr>
                  )}
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        {/* Se contrae y se expande — con varios días de marcas, la sección
            es larga y no siempre hace falta verla entera (Hugo, 2026-10-15:
            "actividad debe contraerse y ampliarse"). Abierta por defecto:
            el comportamiento de hoy no cambia hasta que alguien la toque. */}
        <button
          type="button"
          onClick={() => {
            setIsActivityOpen((previous) => !previous)
          }}
          className="flex w-fit cursor-pointer items-center gap-1.5 text-lg font-semibold text-ink"
        >
          <Trans>Actividad</Trans>
          <MaterialIcon
            name={isActivityOpen ? 'expand_less' : 'expand_more'}
            className="text-xl text-ink-3"
            aria-hidden
          />
        </button>
        {isActivityOpen &&
          (activityByDay.length === 0 ? (
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
          ))}
      </section>
    </>
  )
}

function AttendanceDayRow({
  entry,
  row,
  onCorrectPunch,
  onReview,
  isRecalculatingLunch,
}: {
  entry: TimesheetEntry
  row: TimesheetRow
  onCorrectPunch?:
    ((target: { punch: TimesheetPunch; date: string; workerName: string }) => void) | undefined
  onReview?: ReviewHandler | undefined
  isRecalculatingLunch: boolean
}): ReactNode {
  const { t, i18n } = useLingui()
  const workerName = row.workerName
  const clockIn = entry.punches.find((punch) => punch.type === 'CLOCK_IN')
  const clockOut = entry.punches.find((punch) => punch.type === 'CLOCK_OUT')
  /* Tarifa de la SEMANA (la misma en cada fila) — pero solo "gana" el día
     que de verdad tiene horas; un descanso no multiplica (Hugo, 2026-10-15). */
  const rate =
    entry.hours !== null &&
    entry.hours > 0 &&
    row.payPreview?.payRate !== null &&
    row.payPreview?.payRate !== undefined
      ? Number(row.payPreview.payRate)
      : null
  const hasOvertime = (row.payPreview?.overtimeMinutes ?? 0) > 0
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
      <td className="px-4 py-3 text-right font-semibold text-ink">
        {isRecalculatingLunch ? (
          <Skeleton className="ml-auto h-4 w-10" />
        ) : (
          <>
            {entry.hours !== null ? formatHours(entry.hours) : '—'}
            {/* El descuento del día, no solo el neto ya restado — para que se
                lea "8h, ya con -30min de lonche" y no una resta invisible
                (Hugo, 2026-10-15: "pon -media hora en el timesheet"). 0 cuando
                el hotel paga lonche, o cuando no llegó a las 6.5h que lo
                activan. */}
            {entry.lunchDeductionMinutes > 0 && (
              <span className="block text-xs font-normal text-ink-4">
                <Trans>-{entry.lunchDeductionMinutes} min lonche</Trans>
              </span>
            )}
          </>
        )}
      </td>
      <td className="px-4 py-3 text-right text-ink-2">
        {/* Solo el día que de verdad trabajó multiplica — un descanso no
            "gana" la tarifa aunque sea la misma de toda la semana; repetirla
            en cada fila parecía que CADA día pagaba $16, no uno solo (Hugo,
            2026-10-15). Skeleton mientras el lonche se recalcula — no toda
            la tabla, solo lo que de verdad cambia (Hugo, 2026-10-15: "no que
            se ponga en toda la tabla el skeleton"). */}
        {isRecalculatingLunch ? (
          <Skeleton className="ml-auto h-4 w-14" />
        ) : rate !== null ? (
          `${formatMoney(rate)}/h`
        ) : (
          formatMoney(0)
        )}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-ink">
        {/* La multiplicación de las dos columnas de al lado, no solo sus
            factores — de dónde sale el Total de abajo (Hugo, 2026-10-15).
            `≈`: en una semana con horas extra el 1.5× se aplica sobre el
            total de la semana (D-10), no día por día — este número asume
            la tarifa plana y puede no ser exacto para el día que cruza el
            umbral; el Total de abajo sí es el real. */}
        {isRecalculatingLunch ? (
          <Skeleton className="ml-auto h-4 w-14" />
        ) : rate !== null ? (
          <>
            {hasOvertime && <span className="mr-0.5 text-ink-4">≈</span>}
            {formatMoney(rate * (entry.hours ?? 0))}
          </>
        ) : (
          formatMoney(0)
        )}
      </td>
    </tr>
  )
}
