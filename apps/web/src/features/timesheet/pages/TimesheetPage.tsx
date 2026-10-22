import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon, statusLight, toast } from '@oranje/ui'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  filterTimesheetRows,
  useGetTimesheetMonthQuery,
  useGetTimesheetTimelineQuery,
  useGetTimesheetWeekQuery,
} from '../api/timesheetApi'
import { AttendanceView } from '../components/AttendanceView'
import { CorrectPunchDialog } from '../components/CorrectPunchDialog'
import { HotelPaysLunchToggle } from '../components/HotelPaysLunchToggle'
import { ManualPunchDialog } from '../components/ManualPunchDialog'
import { ReviewDayDialog } from '../components/ReviewDayDialog'
import { TimesheetGrid } from '../components/TimesheetGrid'
import { TimesheetHoursView } from '../components/TimesheetHoursView'
import { TimesheetMonthView } from '../components/TimesheetMonthView'
import { TimesheetToolbar } from '../components/TimesheetToolbar'
import { WeekNavigator, type TimesheetView } from '../components/TimesheetViewControls'
import { WeekSlider } from '../components/WeekSlider'
import { addDaysIso, resolveWeek } from '../lib/weekNavigation'
import {
  ANY_VALUE,
  EMPTY_TIMESHEET_FILTERS,
  type ManualPunchTarget,
  type ReviewContext,
  type TimesheetEntry,
  type TimesheetFilters,
  type TimesheetPunch,
} from '../types/timesheet.types'

import personajeContabilidad from '@/assets/ilustrations/personaje-contabilidad.svg'
import personajeManager from '@/assets/ilustrations/personaje-manager.svg'
import personajePagoProcesado from '@/assets/ilustrations/personaje-pago-procesado.svg'
import fotoEquipo from '@/assets/ilustrations/timesheet-equipo.webp'
import { PayOverrideDialog, type PayOverrideTarget } from '@/features/accounting'
// Dato de nómina del hotel: lo lee y lo escribe Contabilidad desde aquí
// mismo (Hugo, 2026-10-14), no desde el perfil del hotel (que no alcanza).
// eslint-disable-next-line no-restricted-imports
import {
  useGetAccountingTimesheetsQuery,
  useGetHotelPaysLunchQuery,
  useSetHotelPaysLunchMutation,
} from '@/features/accounting/api/settlementApi'
// Contabilidad genera el Consolidado desde aquí mismo, junto al filtro de
// Hotel — no es un botón de aprobación del hotel (Hugo, 2026-10-14).
// eslint-disable-next-line no-restricted-imports
import { GeneratePaymentRunButton } from '@/features/accounting/components/GeneratePaymentRunButton'
import { useGetApprovedPendingInclusionQuery } from '@/features/recruitment'
import { Button } from '@/shared/components/Button'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { Modal } from '@/shared/components/Modal'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { ReloadButton } from '@/shared/components/ReloadButton'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import {
  DEFAULT_COLUMN_WIDTH,
  TIMESHEET_STATUS_LABEL,
  TIMESHEET_STATUS_TOKEN,
  TIMESHEET_STATUSES,
} from '@/shared/constants/timesheetStatus'
import { useCan } from '@/shared/hooks/useCan'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatWeekRange } from '@/shared/lib/formatters'

/**
 * Solo para quien ve todos los hoteles (Contabilidad, el Manager de QA): el
 * Supervisor y los Managers ya conocen esta pantalla, así que no les toca
 * (Hugo, 2026-10-14: "créale onboarding también a Contabilidad"). El texto
 * se traduce al pintar con `i18n._()` (D-36), como el resto de los intros.
 */
const ACCOUNTING_INTRO_SLIDES: readonly {
  image: string
  title: MessageDescriptor
  text: MessageDescriptor
}[] = [
  {
    image: personajeContabilidad,
    title: msg`El mismo Timesheet del hotel, de todos a la vez`,
    text: msg`Solo lectura: las horas se capturan y revisan en cada hotel. Aquí ves el semáforo de la semana de todos — filtra por Hotel para quedarte en uno solo.`,
  },
  {
    image: personajePagoProcesado,
    title: msg`«Aprobada y enviada a Oranje» es del hotel, no tuya`,
    text: msg`Te dice que esa semana ya está lista para el Consolidado — no es un botón, es el estado que dejó el Manager al aprobarla.`,
  },
  {
    image: personajeContabilidad,
    title: msg`Generar Consolidado es tu botón`,
    text: msg`Corre el corte de todos los hoteles con horas aprobadas esa semana. Es idempotente: repetirlo no duplica nada de lo que ya quedó en un Consolidado.`,
  },
]

/**
 * Timesheet semanal: qué marcó cada persona y en qué punto va su revisión.
 *
 * La selección vive aquí y no en cada celda porque cruza filas: se eligen días
 * de varias personas para actuar sobre todos a la vez, que es de lo que habla
 * el chip «Pagar N» de cada renglón.
 */
export function TimesheetPage(): ReactNode {
  const { t, i18n } = useLingui()
  const { isIntroOpen, dismissIntro, reopenIntro } = useIntroSeen('timesheet-contabilidad-global')
  const [filters, setFilters] = useState<TimesheetFilters>(EMPTY_TIMESHEET_FILTERS)
  const [columnWidth, setColumnWidth] = useState<number>(DEFAULT_COLUMN_WIDTH)
  /** Densidad de la semana: la rejilla de chips o el lienzo de horas. Entra
      por Asistencia — es la que responde "¿quién está hoy?" de un vistazo
      (Hugo, 2026-10-10). */
  const [view, setView] = useState<TimesheetView>('ATTENDANCE')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  /** El día abierto en Revisión (maqueta del Supervisor); `null` = cerrado. */
  const [review, setReview] = useState<{
    entry: TimesheetEntry
    workerName: string
    context: ReviewContext | null
    /** Con qué abrir Marca manual si la piden desde aquí mismo. */
    manualPunchTarget: ManualPunchTarget
  } | null>(null)
  /** La fila con el diálogo de marca manual abierto; `null` = cerrado. */
  const [manualPunchRow, setManualPunchRow] = useState<ManualPunchTarget | null>(null)
  /** El día a precargar cuando Marca manual se abrió desde Revisión del día. */
  const [manualPunchInitialDate, setManualPunchInitialDate] = useState<string | null>(null)
  /** La hoja con la corrección de pago abierta; `null` = cerrado. */
  const [overrideTarget, setOverrideTarget] = useState<PayOverrideTarget | null>(null)
  /** La marca abierta en Corregir; `null` = cerrado. Distinto de Marca manual:
      esta edita una que YA existe (Hugo, 2026-10-10). */
  const [correctPunchTarget, setCorrectPunchTarget] = useState<{
    punch: TimesheetPunch
    date: string
    workerName: string
  } | null>(null)

  const can = useCan()
  /** Pagar es de Contabilidad (doble firma del Flujo de Nómina), no del Hotel. */
  const canPay = can('payroll:validate') || can('payroll:authorize')
  /** Lo que el permiso no autoriza no se dibuja: el Manager de QA solo lee. */
  const canReview = can('timesheet:review_punches')
  const canManualPunch = can('timesheet:create_manual_punch')
  /** Corregir una marca ya registrada: Manager de Área/General, sembrado
      desde el 2026-09-29 y conectado hoy (Hugo, 2026-10-10). */
  const canCorrectPunch = can('timesheet:correct_punch')
  const seesAllHotels = can('timesheet:read_all_hotels')
  /** Incluir un ajuste/gasto en la nómina es de Contabilidad, no de
      `read_all_hotels` a secas: el Manager de QA ve todos los hoteles pero no
      puede incluir nada (Hugo, 2026-10-14). */
  const canIncludeAdjustments = can('payroll:generate')

  const { data: week, isLoading, isFetching, isError, refetch } = useGetTimesheetWeekQuery(filters)
  const { data: pendingAdjustments = [] } = useGetApprovedPendingInclusionQuery(undefined, {
    skip: !canIncludeAdjustments,
  })
  /**
   * La CINTA para la vista Días: todas las semanas de una vez. `weekStart` va
   * fijo en ALL para que navegar NO cambie la llave de caché — moverse de
   * semana es mover la ventana, no pedir datos.
   */
  const { data: timeline } = useGetTimesheetTimelineQuery({ ...filters, weekStart: ANY_VALUE })
  /** El agregado del mes solo se pide cuando la vista Mes está a la vista. */
  const { data: month } = useGetTimesheetMonthQuery(filters, { skip: view !== 'MONTH' })

  const availableWeeks = timeline?.availableWeeks ?? week?.availableWeeks ?? []
  /** La semana en la ventana: la pedida si existe; si no, la más reciente. */
  const selectedWeek = resolveWeek(availableWeeks, filters.weekStart)
  /**
   * `week.rows` ya NO viene filtrada por hotel/búsqueda/requisición (ver
   * `getTimesheetWeek` en `timesheetApi.ts`): elegir un hotel dejó de
   * disparar la red entera, así que ahora quien pinta filtra.
   */
  const visibleRows = useMemo(() => filterTimesheetRows(week?.rows ?? [], filters), [week, filters])
  /** De cualquier fila de ESE hotel con timesheet real: basta con una para
      saber el id (D-28). Ajena a la búsqueda/requisición a propósito — no
      queremos perder la casilla de lonche solo porque además escribiste
      algo en el buscador. */
  const selectedHotelId =
    filters.hotelName === ANY_VALUE
      ? null
      : ((week?.rows ?? []).find(
          (row) => row.hotelName === filters.hotelName && row.hotelId !== null,
        )?.hotelId ?? null)

  /** Todas las hojas del hotel, SIN acotar a la semana en pantalla — de ahí
      salen dos cosas que "Cerrar semana" necesita saber ANTES de abrirse,
      no después (Hugo, 2026-10-15: "para qué abrir el modal si no se
      puede"): quién de ESTA semana le falta aprobar, y qué semanas
      ANTERIORES se quedaron atrás sin aprobar del todo. */
  const { data: hotelTimesheets } = useGetAccountingTimesheetsQuery(
    { hotelId: selectedHotelId ?? '' },
    { skip: !selectedHotelId || !canIncludeAdjustments },
  )
  const blockedThisWeek = (hotelTimesheets ?? []).filter(
    (sheet) => sheet.weekStart === selectedWeek && sheet.status !== 'APPROVED',
  )
  /** Una sola semana puede traer dos hojas sin aprobar del mismo colaborador
      (dos requisiciones) — un nombre repetido confundiría más que ayudar.
      El estado viaja con el nombre: "Cerrar semana" lo usa para decir POR
      QUÉ está desactivado, no solo QUIÉN falta. */
  const blocked = [
    ...new Map(
      blockedThisWeek.map((sheet) => [
        sheet.worker.fullName,
        { name: sheet.worker.fullName, status: sheet.status as 'OPEN' | 'PENDING_APPROVAL' },
      ]),
    ).values(),
  ]
  const overdueWeeks = useMemo(() => {
    const byWeek = new Map<string, number>()
    for (const sheet of hotelTimesheets ?? []) {
      if (sheet.status === 'APPROVED' || sheet.weekStart === selectedWeek) continue
      if (selectedWeek !== null && sheet.weekStart >= selectedWeek) continue
      byWeek.set(sheet.weekStart, (byWeek.get(sheet.weekStart) ?? 0) + 1)
    }
    return [...byWeek.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, count]) => ({ weekStart, count }))
  }, [hotelTimesheets, selectedWeek])

  /** El interruptor de lonche vive aquí, no dentro del componente — así
      `isSavingLunch` se puede combinar con el `isFetching` del Timesheet
      para avisarle a la tabla cuándo poner SU propio skeleton acotado, sin
      repetir la consulta en dos componentes (Hugo, 2026-10-15: "no que se
      ponga en toda la tabla el skeleton"). */
  const { data: paysLunch, isFetching: isFetchingPaysLunch } = useGetHotelPaysLunchQuery(
    selectedHotelId ?? '',
    { skip: !selectedHotelId || !canIncludeAdjustments },
  )
  const [setPaysLunch, { isLoading: isSavingLunch }] = useSetHotelPaysLunchMutation()
  /* `isFetching` de /timesheets sube por CUALQUIER refetch (cambiar de
     semana, de estado…), no solo por el lonche — esta bandera acota el
     "se está recalculando" a la ventana real: desde que se toca el
     interruptor hasta que ese mismo refetch termina, ni un segundo más ni
     uno de más por otra razón. */
  const [lunchJustToggled, setLunchJustToggled] = useState(false)
  useEffect(() => {
    if (lunchJustToggled && !isSavingLunch && !isFetching) setLunchJustToggled(false)
  }, [lunchJustToggled, isSavingLunch, isFetching])
  const isRecalculatingLunch = isSavingLunch || (lunchJustToggled && isFetching)

  async function toggleLunch(next: boolean): Promise<void> {
    if (!selectedHotelId) return
    setLunchJustToggled(true)
    try {
      await setPaysLunch({ hotelId: selectedHotelId, paysLunch: next }).unwrap()
      toast.success(
        next
          ? t`El hotel paga el lonche: las horas quedan completas.`
          : t`El hotel no paga el lonche: se resta media hora con 6.5 h o más.`,
      )
    } catch (error) {
      setLunchJustToggled(false)
      toast.error(apiErrorMessage(error, { fallback: t`No se pudo guardar. Inténtalo de nuevo.` }))
    }
  }

  function toggle(entryId: string): void {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
  }

  /** De qué requisiciones son los días elegidos. Es lo que resume la selección.
      Se busca en la CINTA: un día elegido puede ser de una semana vecina. */
  const selection = useMemo(() => {
    const entries = (timeline?.rows ?? visibleRows).flatMap((row) =>
      row.entries.filter((entry) => selectedIds.has(entry.id)),
    )

    const withRequisition = entries.filter((entry) => entry.requisitionNumber !== null)
    const numbers = [...new Set(withRequisition.map((entry) => entry.requisitionNumber))]

    return {
      total: entries.length,
      withoutRequisition: entries.length - withRequisition.length,
      numbers,
    }
  }, [timeline, visibleRows, selectedIds])

  /** El rango sale de la semana en la ventana: navega al instante con la cinta. */
  const rangeLabel =
    selectedWeek !== null ? formatWeekRange(selectedWeek, addDaysIso(selectedWeek, 6)) : ''

  /** Cambiar de semana es un filtro más. */
  function selectWeek(target: string): void {
    setFilters((previous) => ({ ...previous, weekStart: target }))
  }

  /** Del mes a la semana: picar un día abre su semana en la vista Días. */
  function pickMonthDay(date: string): void {
    const target = availableWeeks.find((start) => start <= date && date <= addDaysIso(start, 6))
    if (target) selectWeek(target)
    setView('DAYS')
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Misma cabecera-tarjeta que Conversión, Contratos y Propuestas: título
          a la izquierda y la foto (recortada, sin fondo; en el teléfono va una
          captura real del Timesheet en móvil) sentada en el borde inferior y
          sobresaliendo por arriba; el `clip-path` de la tarjeta la recorta con
          las esquinas redondeadas y deja 3rem arriba. El navegador de semana
          y el conmutador de vista bajan al bloque de texto. */}
      <header className="relative flex items-end justify-between gap-4 rounded-2xl border border-line bg-gradient-to-r from-o-50 via-surface to-surface px-6 pt-5 pb-5 [clip-path:inset(-3rem_0_0_0_round_1rem)] sm:mt-8 sm:min-h-44 sm:pr-72">
        <div className="relative z-10">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              <FoldText text={t`Timesheet`} />
            </h1>
            {/* El rango sale de los días que llegaron, no de un texto aparte: así el
                título no puede decir una semana distinta de la que se ve. */}
            {rangeLabel !== '' && (
              <p className="text-base text-ink-3">
                <Trans>Semana {rangeLabel}</Trans>
              </p>
            )}
            <ReloadButton
              onReload={() => {
                void refetch()
              }}
              isReloading={isFetching}
            />
          </div>
          {seesAllHotels && (
            <p className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-ink-3">
              <span className="inline-flex items-center gap-1.5">
                <MaterialIcon name="visibility" className="text-base" aria-hidden />
                {/* Dice lo que de verdad se está viendo — antes decía
                    "Todos los hoteles" sin importar el filtro de abajo, y
                    con un hotel elegido parecía contradecirlo (Hugo,
                    2026-10-14: "¿ya estoy visualizando uno, o son todos?"). */}
                {filters.hotelName !== ANY_VALUE ? (
                  <Trans>Viendo {filters.hotelName} · solo lectura</Trans>
                ) : (
                  <Trans>Viendo todos los hoteles · solo lectura</Trans>
                )}
              </span>
              <button
                type="button"
                onClick={reopenIntro}
                className="cursor-pointer rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-o-700 hover:bg-o-50"
              >
                <Trans>¿Cómo funciona?</Trans>
              </button>
            </p>
          )}

          {/* Para Contabilidad el hotel manda, la semana es dentro de él —
              se mueven por hotel y por sus semanas, no al revés (Hugo,
              2026-10-14). Va primero y más grande; el resto cuelga de ahí. */}
          {seesAllHotels && (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <FilterSelect
                label={t`Hotel`}
                anyLabel={t`Todos los hoteles`}
                value={filters.hotelName}
                anyValue={ANY_VALUE}
                options={(week?.hotelNames ?? []).map((hotel) => ({
                  value: hotel,
                  label: hotel,
                }))}
                onChange={(value) => {
                  setFilters((previous) => ({ ...previous, hotelName: value }))
                }}
                icon="apartment"
                className="py-3 pr-4 text-base font-semibold"
              />
              {/* Es un dato de UN hotel, no un filtro — con "Todos" no hay
                  uno solo que marcar (Hugo, 2026-10-14). Con un hotel
                  elegido, el interruptor real; si no, la pista de por qué
                  no está — para que no parezca que no pasó nada. */}
              {canIncludeAdjustments &&
                (filters.hotelName !== ANY_VALUE && selectedHotelId ? (
                  <HotelPaysLunchToggle
                    checked={paysLunch ?? false}
                    isSaving={isSavingLunch || isFetchingPaysLunch}
                    onToggle={(next) => {
                      void toggleLunch(next)
                    }}
                  />
                ) : (
                  <span className="text-xs text-ink-4">
                    <Trans>Elige un hotel para ajustar si paga el lonche</Trans>
                  </span>
                ))}
            </div>
          )}

          {selectedWeek !== null && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <WeekNavigator
                weekStart={selectedWeek}
                availableWeeks={availableWeeks}
                onSelect={selectWeek}
              />
              {/* A simple vista, sin entrar a cada persona — si TODAS las
                  hojas de este hotel esta semana ya están aprobadas (Hugo,
                  2026-10-15: "con una palomita si la semana que estamos
                  viendo ya se aprobó"). Mismos datos que ya usa "Cerrar
                  semana" y el aviso de atrasadas — nada nuevo que pedir. */}
              {selectedHotelId !== null &&
                blocked.length === 0 &&
                (hotelTimesheets ?? []).some((sheet) => sheet.weekStart === selectedWeek) && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green/10 px-3 py-1 text-xs font-semibold text-green">
                    <MaterialIcon name="check_circle" className="text-sm" aria-hidden />
                    <Trans>Semana aprobada</Trans>
                  </span>
                )}
              {/* Horas/Días/Mes se ocultan por ahora (Hugo, 2026-10-10):
                  "vamos a ir mejorándolo" — la pantalla se queda solo en
                  Asistencia mientras se trabaja esa densidad. `view` ya
                  nace en 'ATTENDANCE' y nada más la cambia, así que basta
                  con no dibujar el selector — no se borró nada. */}
              {/* El botón de Contabilidad, no del hotel: aquí no hay nada
                  que aprobar, hay una semana que cerrar — de ESTE hotel, el
                  mismo que elegiste arriba (Hugo, 2026-10-14: "la imagen
                  del hotel a un lado" — solo hay una foto que mostrar si es
                  un hotel a la vez). */}
              {seesAllHotels && selectedWeek !== null && (
                <GeneratePaymentRunButton
                  weekStart={selectedWeek}
                  hotelId={selectedHotelId}
                  hotelName={filters.hotelName !== ANY_VALUE ? filters.hotelName : null}
                  blocked={blocked}
                />
              )}
            </div>
          )}

          {/* Semanas atrasadas de ESTE hotel: sin esto, no había forma de
              saber que una semana vieja se quedó sin cerrar salvo
              navegándolas una por una (Hugo, 2026-10-15: "cómo se muestra
              las semanas atrasadas"). Clic lleva directo a esa semana. */}
          {selectedHotelId !== null && overdueWeeks.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-yellow/15 px-3 py-2 text-xs text-ink-2">
              <MaterialIcon name="history_toggle_off" className="text-sm text-yellow" aria-hidden />
              <span>
                <Trans>{filters.hotelName} tiene semanas atrasadas sin aprobar:</Trans>
              </span>
              {overdueWeeks.map(({ weekStart, count }) => (
                <button
                  key={weekStart}
                  type="button"
                  onClick={() => {
                    selectWeek(weekStart)
                  }}
                  className="cursor-pointer rounded-full border border-yellow/40 bg-surface px-2 py-0.5 font-semibold text-ink underline-offset-2 hover:underline"
                >
                  {formatWeekRange(weekStart, addDaysIso(weekStart, 6))} · {count}
                </button>
              ))}
            </div>
          )}
        </div>
        <img
          src={fotoEquipo}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-2 -bottom-1 hidden h-[calc(100%+2.5rem)] w-auto object-contain object-bottom drop-shadow-[0_10px_18px_rgba(60,30,0,0.26)] md:block"
        />
      </header>

      {seesAllHotels && (
        <Modal
          isOpen={isIntroOpen}
          onClose={dismissIntro}
          title={t`Cómo funciona este Timesheet para Contabilidad`}
          chromeless
        >
          <OnboardingIntro
            slides={ACCOUNTING_INTRO_SLIDES.map((slide) => ({
              image: slide.image,
              title: i18n._(slide.title),
              text: i18n._(slide.text),
            }))}
            startLabel={t`Entendido`}
            onDone={dismissIntro}
          />
        </Modal>
      )}

      <TimesheetToolbar
        filters={filters}
        requisitionNumbers={week?.requisitionNumbers ?? []}
        hotelNames={week?.hotelNames ?? []}
        columnWidth={columnWidth}
        showZoom={view === 'DAYS'}
        hideHotelFilter
        onChange={setFilters}
        onColumnWidthChange={setColumnWidth}
      />

      {/* Quién sigue: el Supervisor envía, el Manager aprueba (D-09). */}
      {week &&
        !can('timesheet:approve_hours') &&
        visibleRows.some((row) => row.weekStatus === 'PENDING_APPROVAL') && (
          <NoticeCard
            image={personajeManager}
            title={t`La aprobación es del Manager`}
            role="status"
          >
            <Trans>
              Las semanas enviadas las aprueba el Manager de Área de su departamento o el Manager
              General. Hasta entonces las horas no se pagan ni se facturan.
            </Trans>
          </NoticeCard>
        )}

      {/* La leyenda de los estados del día: solo aplica a Horas/Días, que
          hoy están ocultas (Hugo, 2026-10-10); en Asistencia no hay ningún
          punto de color que explicar (Hugo, 2026-10-12: "¿ya no se
          necesita?" — correcto, quedó huérfana al quitar la columna
          Estado). Se deja condicionada, no se borra, para cuando esas
          vistas vuelvan. */}
      {week && visibleRows.length > 0 && (view === 'DAYS' || view === 'HOURS') && (
        <div className="-mt-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
          {TIMESHEET_STATUSES.map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5 text-xs text-ink-3">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: statusLight[TIMESHEET_STATUS_TOKEN[status]] }}
                aria-hidden
              />
              {TIMESHEET_STATUS_LABEL[status]}
            </span>
          ))}
          {/* El contorno del carril también se explica en la leyenda. */}
          {view === 'DAYS' && (
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
              <span className="h-3.5 w-6 rounded-md border border-o-500/50" aria-hidden />
              <Trans>Días de una misma requisición</Trans>
            </span>
          )}
        </div>
      )}

      {selection.total > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-purple bg-purple/10 px-5 py-3">
          <p className="text-sm font-semibold text-ink">
            <Plural value={selection.total} one="# día elegido" other="# días elegidos" />
          </p>
          <p className="text-sm text-ink-2">
            {selection.numbers.length > 0 ? selection.numbers.join(' · ') : t`sin requisición`}
            {selection.withoutRequisition > 0 &&
              selection.numbers.length > 0 &&
              ` · ${t`${selection.withoutRequisition} sin requisición`}`}
          </p>

          <div className="ml-auto flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedIds(new Set())
              }}
            >
              <Trans>Quitar selección</Trans>
            </Button>
            {/* Pagar NO es del Hotel: doble firma de Contabilidad (Flujo de
                Nómina). Quien no puede no ve un botón muerto — ve quién sí,
                que es el patrón acordado del barrido de permisos. */}
            {canPay ? (
              <Button
                variant="primary"
                disabled
                title={t`El pago en bloque aún no está disponible`}
              >
                <Trans>Pagar seleccionados</Trans>
              </Button>
            ) : (
              <span className="rounded-md border border-dashed border-line px-2.5 py-1 text-xs text-ink-3">
                <Trans>El pago lo hace Contabilidad cuando la semana está aprobada</Trans>
              </span>
            )}
          </div>
        </div>
      )}

      {isError && (
        <LoadError
          message={t`No se pudo cargar la semana del Timesheet. Reintenta en unos segundos.`}
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading || (isFetching && !isRecalculatingLunch) ? (
        /* Antes solo se veía la primera vez (`isLoading && !week`): cambiar
           el filtro "Estado" (el único que va al servidor) dejaba la tabla
           vieja quieta mientras llegaba la nueva, sin ningún aviso (Hugo,
           2026-10-12). `!isRecalculatingLunch`: ESE refetch ya tiene su
           propio skeleton acotado adentro de Asistencia — mostrar además
           este de página completa sería tapar justo lo que se quería ver
           cambiar (Hugo, 2026-10-15). */
        <TableSkeleton rows={7} columns={8} />
      ) : (
        selectedWeek !== null &&
        week && (
          <WeekSlider
            weekStart={selectedWeek}
            availableWeeks={availableWeeks}
            /* La unidad del carrusel: una semana completa en px (7 columnas). */
            stepWidth={7 * columnWidth}
            totalDays={timeline?.days.length ?? 7}
            /* Solo Días dibuja la cinta completa: ahí el arrastre es continuo. */
            continuous={view === 'DAYS'}
            /* La rejilla de Días scrollea horizontal por sí misma: ahí el dedo
               scrollea y la navegación táctil queda en ‹ ›; en Horas y Mes el
               swipe sí navega. */
            allowTouchDrag={view !== 'DAYS'}
            onNavigate={selectWeek}
          >
            {view === 'DAYS' &&
              (timeline ? (
                <TimesheetGrid
                  timeline={timeline}
                  selectedWeek={selectedWeek}
                  columnWidth={columnWidth}
                  selectedIds={selectedIds}
                  selectable={canPay}
                  onToggle={toggle}
                  onReview={(entry, workerName, context, manualPunchTarget) => {
                    setReview({ entry, workerName, context: context ?? null, manualPunchTarget })
                  }}
                  onManualPunch={
                    canManualPunch
                      ? (row) => {
                          setManualPunchRow(row)
                          setManualPunchInitialDate(null)
                        }
                      : undefined
                  }
                />
              ) : (
                <TableSkeleton rows={7} columns={8} />
              ))}
            {view === 'HOURS' &&
              (timeline ? (
                <TimesheetHoursView
                  timeline={timeline}
                  selectedWeek={selectedWeek}
                  onReview={(entry, workerName, context, manualPunchTarget) => {
                    setReview({ entry, workerName, context: context ?? null, manualPunchTarget })
                  }}
                />
              ) : (
                <TableSkeleton rows={7} columns={8} />
              ))}
            {view === 'MONTH' &&
              (month ? (
                <TimesheetMonthView month={month} onPickDay={pickMonthDay} />
              ) : (
                <TableSkeleton rows={5} columns={7} />
              ))}
            {view === 'ATTENDANCE' && selectedWeek !== null && (
              <AttendanceView
                rows={visibleRows}
                selectedWeek={selectedWeek}
                pendingAdjustments={pendingAdjustments}
                isRecalculatingLunch={isRecalculatingLunch}
                onCorrectOvertime={canIncludeAdjustments ? setOverrideTarget : undefined}
                onReview={(entry, workerName, context, manualPunchTarget) => {
                  setReview({ entry, workerName, context: context ?? null, manualPunchTarget })
                }}
                onManualPunch={
                  canManualPunch
                    ? (row) => {
                        setManualPunchRow(row)
                        setManualPunchInitialDate(null)
                      }
                    : undefined
                }
                onCorrectPunch={canCorrectPunch ? setCorrectPunchTarget : undefined}
              />
            )}
          </WeekSlider>
        )
      )}

      <ManualPunchDialog
        row={manualPunchRow}
        initialDate={manualPunchInitialDate}
        onClose={() => {
          setManualPunchRow(null)
          setManualPunchInitialDate(null)
        }}
      />

      <PayOverrideDialog
        target={overrideTarget}
        onClose={() => {
          setOverrideTarget(null)
        }}
      />

      <ReviewDayDialog
        entry={review?.entry ?? null}
        workerName={review?.workerName ?? ''}
        context={review?.context ?? null}
        readOnly={!canReview}
        onManualPunch={
          review && canManualPunch
            ? () => {
                setManualPunchRow(review.manualPunchTarget)
                setManualPunchInitialDate(review.entry.date)
                setReview(null)
              }
            : undefined
        }
        onCorrectPunch={
          review && canCorrectPunch
            ? (punch) => {
                setCorrectPunchTarget({
                  punch,
                  date: review.entry.date,
                  workerName: review.workerName,
                })
                setReview(null)
              }
            : undefined
        }
        onClose={() => {
          setReview(null)
        }}
      />

      <CorrectPunchDialog
        target={correctPunchTarget}
        workerName={correctPunchTarget?.workerName ?? ''}
        onClose={() => {
          setCorrectPunchTarget(null)
        }}
      />
    </div>
  )
}
