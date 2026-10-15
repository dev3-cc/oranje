import { i18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import { addDaysIso, resolveWeek, todayIso } from '../lib/weekNavigation'
import {
  ANY_VALUE,
  type ReviewDayRequest,
  type TimesheetEntry,
  type TimesheetFilters,
  type TimelineRow,
  type TimesheetMonth,
  type TimesheetMonthDay,
  type TimesheetTimeline,
  type TimesheetPunch,
  type TimesheetRow,
  type TimesheetWeek,
} from '../types/timesheet.types'

import { registerTimesheetMocks } from './timesheetMocks'

import { baseApi } from '@/app/baseApi'
import { NO_TIMESHEET_STATUS } from '@/shared/constants/timesheetStatus'
import type { TimesheetStatus } from '@/shared/constants/timesheetStatus'
import { fetchAllPages } from '@/shared/lib/fetchAllPages'
import { formatTimeIn, todayIn } from '@/shared/lib/formatters'
import type {
  ApiEnvelope,
  CatalogItemApi,
  TimesheetApi,
  TimesheetDayApi,
  TimesheetPunchApi,
  WorkerApi,
} from '@/shared/types/apiContract.types'

/**
 * El Timesheet sobre el contrato REAL de `operations`: `GET /timesheets`
 * (scoped por el hotel/departamento de quien pregunta, D-09) + el detalle por
 * timesheet con días y marcas. Revisar un día es `POST /timesheet-days/:id/review`,
 * que es el paso del Supervisor; enviar y aprobar son del flujo de D-09.
 */
registerTimesheetMocks()

/** `fetchWithBQ` de un `queryFn`: el tipo exacto no está exportado por RTK. */
type FetchWithBQ = (
  args: string | { url: string; method?: string; body?: unknown; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

const MS_PER_DAY = 86_400_000

/**
 * `/workers`, `/requisitions` y `/me` no cambian por mover una casilla — pero
 * `fetchWeek`/`fetchTimeline` los piden de cero en CADA refetch (incluido el
 * que dispara "paga lonche" al invalidar todo el Timesheet), y `/workers`
 * pagina cientos de filas: ahí vivía la tardanza que Hugo reportó (2026-10-15,
 * "por qué tarda en recalcular"), no en el PATCH del hotel, que responde en
 * ~2s. Memoria de módulo con una ventana corta — se pierde sola al recargar
 * la pestaña — para que un recálculo por lonche reuse lo que acaba de pedir
 * el mismo Timesheet, sin inventar una capa de caché nueva para todo el app.
 */
const SHARED_FETCH_TTL_MS = 20_000
const sharedFetchCache = new Map<string, { expiresAt: number; promise: Promise<unknown> }>()

async function withSharedFetchCache<T>(key: string, load: () => Promise<T>): Promise<T> {
  const cached = sharedFetchCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.promise as Promise<T>

  const promise = load()
  sharedFetchCache.set(key, { expiresAt: Date.now() + SHARED_FETCH_TTL_MS, promise })
  // Una carga que falla no debe quedar "cacheada" bloqueando los próximos
  // 20s — el siguiente intento vuelve a pedir de verdad.
  promise.catch(() => {
    sharedFetchCache.delete(key)
  })
  return promise
}

/** El lunes de la semana que contiene a hoy — para que siempre haya una
    semana navegable aunque nadie haya ponchado nunca (Hugo, 2026-10-13). */
function currentWeekMonday(): string {
  const today = todayIso()
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay()
  return addDaysIso(today, dow === 0 ? -6 : 1 - dow)
}

/**
 * La hora del ponche en la zona horaria del HOTEL, no la del navegador que la
 * lee: mostrar el ISO crudo (UTC) hacía que el Timesheet enseñara la misma
 * hora sin importar el hotel — reportado por Hugo ponchando en Cancún.
 */
function timeOf(iso: string, timeZone: string | undefined): string {
  return formatTimeIn(iso, timeZone)
}

/**
 * Lo que el Timesheet necesita saber de cada requisición: folio y hotel.
 * Exportado para Contabilidad (`settlementApi.ts`), que arma su propia cinta
 * de días con esta misma pieza en vez de tocar la del staff (Hugo, 2026-10-08).
 */
export interface RequisitionRefInfo {
  number: string
  hotelName: string
  hotelPhotoUrl: string | null
  hotelTimeZone: string | undefined
}

/**
 * Índice id → folio/hotel desde `/requisitions` (composición D-28). Tolerante
 * a fallos: sin él, el folio cae al id recortado y el hotel al de `/me`
 * (criterio D-30 — un dato de adorno no tumba la pantalla).
 */
export async function fetchRequisitionIndex(
  fetchWithBQ: FetchWithBQ,
): Promise<Map<string, RequisitionRefInfo>> {
  const index = new Map<string, RequisitionRefInfo>()
  const res = await fetchWithBQ('/requisitions')
  if (res.error) return index
  const items = (
    res.data as ApiEnvelope<
      Array<{
        id: string
        number: string
        hotel: { name: string; photoUrl?: string | null; timeZone?: string }
      }>
    >
  ).data
  for (const item of items) {
    index.set(item.id, {
      number: item.number,
      hotelName: item.hotel.name,
      hotelPhotoUrl: item.hotel.photoUrl ?? null,
      hotelTimeZone: item.hotel.timeZone,
    })
  }
  return index
}

/** El folio REAL si el índice lo tiene; si no, el id recortado (fallback honesto). */
export function requisitionRefOf(
  index: Map<string, RequisitionRefInfo>,
  requisitionId: string,
): string {
  return index.get(requisitionId)?.number ?? `req ${requisitionId.slice(0, 8)}`
}

function toPunch(punch: TimesheetPunchApi, hotelTimeZone: string | undefined): TimesheetPunch {
  return {
    id: punch.id,
    type: punch.type,
    serverTime: timeOf(punch.serverAt, hotelTimeZone),
    deviceTime: punch.deviceAt ? timeOf(punch.deviceAt, hotelTimeZone) : null,
    insideGeofence: punch.insideGeofence,
    isManual: punch.isManual,
    manualReason: punch.manualReason,
  }
}

/** El estado del día se DERIVA: anomalía sin resolver, nota escrita, o pendiente. */
function dayStatus(day: TimesheetDayApi): TimesheetStatus {
  if (day.hasAnomaly && day.reviewNote === null) return 'OBSERVED'
  if (day.reviewNote !== null) return 'REVIEWED'
  return 'PENDING'
}

/**
 * Día sintetizado para quien tiene asignación ACTIVA pero ningún timesheet
 * esta semana — no hay fila real de `operations.timesheet_day` que convertir
 * (Hugo, 2026-10-13: "deberían aparecer todos... no sabemos si no ponchó en
 * toda la semana"). `weekStatus: 'NO_TIMESHEET'` en la fila ya impide
 * enviarlo o aprobarlo; aquí solo se enseña un día vacío, no se inventa hora.
 */
function emptyEntry(date: string, requisitionRef: string): TimesheetEntry {
  return {
    id: `virtual:${date}`,
    date,
    status: 'PENDING',
    hours: null,
    lunchDeductionMinutes: 0,
    startTime: null,
    endTime: null,
    requisitionNumber: requisitionRef,
    punch: 'NO_SHIFT',
    hasAnomaly: false,
    continuesNextDay: false,
    continuesFromPreviousDay: false,
    isAbsence: false,
    reviewNote: null,
    dayStatus: null,
    punches: [],
  }
}

export function toEntry(
  day: TimesheetDayApi,
  requisitionRef: string,
  hotelTimeZone: string | undefined,
): TimesheetEntry {
  const punches = day.punches.map((punch) => toPunch(punch, hotelTimeZone))
  const clockIn = punches.find((punch) => punch.type === 'CLOCK_IN')
  const clockOut = punches.find((punch) => punch.type === 'CLOCK_OUT')
  /* Hoy con solo entrada no es un día incompleto: la jornada sigue — se lee
     en la zona del HOTEL, no en la de quien revisa (mismo criterio que la
     hora de la marca, Hugo, 2026-10-01). */
  const isToday = day.workDate === todayIn(hotelTimeZone)

  return {
    id: day.id,
    date: day.workDate,
    status: dayStatus(day),
    hours: day.isAbsence ? null : Math.round((day.netMinutes / 60) * 100) / 100,
    lunchDeductionMinutes: day.lunchDeductionMinutes,
    startTime: clockIn?.serverTime ?? null,
    endTime: clockOut?.serverTime ?? null,
    requisitionNumber: requisitionRef,
    punch:
      clockIn && clockOut
        ? 'COMPLETE'
        : punches.length === 0
          ? 'NO_SHIFT'
          : isToday
            ? 'IN_PROGRESS'
            : 'INCOMPLETE',
    hasAnomaly: day.hasAnomaly,
    continuesNextDay: day.continuesNextDay,
    continuesFromPreviousDay: day.continuesFromPreviousDay,
    isAbsence: day.isAbsence,
    reviewNote: day.reviewNote,
    dayStatus: day.dayStatus,
    punches,
  }
}

/**
 * Lo que viaja al servidor: el estado y el periodo.
 *
 * El periodo se manda, no se recorta aquí: pedir todas las semanas y filtrar
 * después deja que el tope del listado muerda antes — y cuando muerde, la
 * pantalla enseña lo que quepa sin decir que cortó (Hugo, 2026-10-05).
 */
function paramsDe(filters: TimesheetFilters): Record<string, string> {
  return {
    ...(filters.status !== ANY_VALUE ? { status: filters.status } : {}),
    ...(filters.from !== '' ? { from: filters.from } : {}),
    ...(filters.to !== '' ? { to: filters.to } : {}),
  }
}

/**
 * Acota los timesheets al periodo elegido (Hugo, 2026-10-05).
 *
 * Se aplica en LAS TRES vistas, en el mismo punto donde cada una extrae la
 * lista, porque de ahí sale `availableWeeks` — y de `availableWeeks` sale lo
 * que pinta la cinta, a qué semana saltan las flechas y qué mes abre el
 * calendario. Filtrar aquí hace que las tres queden dentro del rango sin
 * lógica propia en ninguna.
 *
 * Una semana entra si **toca** el periodo, no si cabe entero: quien pide
 * «del 1 al 20» espera ver la semana que empieza el 29 y termina el 4.
 *
 * **El servidor ya filtra por fechas**; esto se queda como segunda línea por
 * una razón concreta: los mocks locales no aplican el `WHERE` del back, y un
 * mock que no se comporta como el servidor es justo lo que escondió el
 * defecto del Self-Pick en septiembre. Con el filtro también aquí, lo que se
 * ve en local es lo que se verá en producción.
 */
export function enElPeriodo(timesheets: TimesheetApi[], filters: TimesheetFilters): TimesheetApi[] {
  if (filters.from === '' && filters.to === '') return timesheets

  return timesheets.filter((sheet) => {
    const inicio = sheet.weekStart
    const fin = addDaysIso(inicio, 6)
    if (filters.to !== '' && inicio > filters.to) return false
    if (filters.from !== '' && fin < filters.from) return false
    return true
  })
}

async function fetchWeek(
  fetchWithBQ: FetchWithBQ,
  filters: TimesheetFilters,
): Promise<{ data: TimesheetWeek } | { error: unknown }> {
  const [listRes, meRes, workersRes, requisitionIndex] = await Promise.all([
    fetchWithBQ({
      url: '/timesheets',
      params: paramsDe(filters),
    }),
    withSharedFetchCache('timesheet:me', () => fetchWithBQ('/me')),
    /* `GET /timesheets/:id` no trae foto ni puesto del colaborador (D-28):
       se compone con `/workers`, igual que ya hace la cinta continua
       (`fetchTimeline`) — si falla, la fila degrada con fallbacks (D-30).
       Ninguno de los tres cambia porque un hotel prenda/apague el lonche —
       con caché compartida de 20s, ese recálculo no vuelve a paginar a
       todo el personal (Hugo, 2026-10-15). */
    withSharedFetchCache('timesheet:workers', () =>
      fetchAllPages<WorkerApi>(fetchWithBQ, '/workers'),
    ),
    withSharedFetchCache('timesheet:requisitions', () => fetchRequisitionIndex(fetchWithBQ)),
  ])
  if (listRes.error) return { error: listRes.error }
  if (meRes.error) return { error: meRes.error }

  const timesheets = enElPeriodo((listRes.data as ApiEnvelope<TimesheetApi[]>).data, filters)
  const me = (meRes.data as ApiEnvelope<{ hotel: { name: string } | null }>).data
  const fallbackHotel = me.hotel?.name ?? '—'

  /* Sin `GET /timesheets/:id` ni `/workers`: un colaborador que nunca
     ponchó en toda la semana no tiene fila de timesheet (se crea solo al
     primer ponche), así que antes desaparecía — no se sabía que faltó
     (Hugo, 2026-10-13). Si `/workers` falla (403, p. ej. Contabilidad en
     Timesheet Global, que no tiene `staff:read`), degrada a lo de siempre:
     ningún colaborador sin marcas se pierde por eso, solo no se completa. */
  const workers: WorkerApi[] = 'error' in workersRes ? [] : workersRes.data
  const workerInfo = new Map<string, { photoUrl: string | null; jobTitle: string }>()
  for (const worker of workers) {
    workerInfo.set(worker.id, {
      photoUrl: worker.photoUrl,
      jobTitle: worker.position?.name ?? '—',
    })
  }

  /**
   * La pantalla es UNA semana. Las disponibles salen de lo que llegó (el
   * contrato no pagina por fecha) más la semana en curso, para que siempre
   * haya algo que ver aunque nadie haya ponchado todavía esta semana.
   */
  const availableWeeks = [
    ...new Set([...timesheets.map((sheet) => sheet.weekStart), currentWeekMonday()]),
  ].sort()
  const weekStart = resolveWeek(availableWeeks, filters.weekStart) as string
  const ofWeek = timesheets.filter((sheet) => sheet.weekStart === weekStart)
  const days = Array.from({ length: 7 }, (_item, index) => addDaysIso(weekStart, index))

  /** Días y marcas viven en el detalle: se piden en paralelo (D-28). */
  const details = await Promise.all(ofWeek.map((sheet) => fetchWithBQ(`/timesheets/${sheet.id}`)))

  const rows: TimesheetRow[] = []
  for (const [index, sheet] of ofWeek.entries()) {
    const detailRes = details[index]
    if (!detailRes || detailRes.error) continue
    const detail = (detailRes.data as ApiEnvelope<TimesheetApi>).data
    /** El folio REAL sale del índice de requisiciones (ya no el id recortado). */
    const requisitionRef = requisitionRefOf(requisitionIndex, detail.requisitionId)
    const hotelTimeZone = requisitionIndex.get(detail.requisitionId)?.hotelTimeZone

    rows.push({
      timesheetId: sheet.id,
      requisitionId: detail.requisitionId,
      assignment: detail.assignment,
      workerId: detail.worker.id,
      workerName: detail.worker.fullName,
      jobTitle: workerInfo.get(detail.worker.id)?.jobTitle ?? '—',
      photoUrl: workerInfo.get(detail.worker.id)?.photoUrl ?? null,
      /* `sheet.hotel` ya viene en el LISTADO (`GET /timesheets`), sin pasar
         por `/requisitions` — que Contabilidad y el Observador no pueden
         leer (403: sus permisos son `read_own`/`read_all` de Hotel y
         Reclutamiento, ninguno el suyo). Antes esta fila caía siempre al
         fallback para esos dos roles, y con un hotel elegido en el filtro
         desaparecía del todo: no tenía con qué calzar (Hugo, 2026-10-14,
         "ya lo elegí y no sale"). */
      hotelName:
        sheet.hotel?.name ?? requisitionIndex.get(detail.requisitionId)?.hotelName ?? fallbackHotel,
      hotelId: sheet.hotel?.id ?? null,
      weekStatus: detail.status,
      totalHours: Math.round(((detail.totals?.netMinutes ?? 0) / 60) * 100) / 100,
      targetHours: null,
      /* `Number(...)` en vez de leer el campo directo: en producción llegó
         `NaNh` a pantalla (Hugo, 2026-10-12) — el contrato promete un
         `number`, pero no se puede confiar en que siempre llegue uno. Mejor
         "—" honesto que una cifra rota. */
      overtimeHours: (() => {
        const minutes = Number(detail.totals?.overtimeMinutes)
        return Number.isFinite(minutes) ? Math.round((minutes / 60) * 100) / 100 : null
      })(),
      entries: (detail.days ?? []).map((day) => toEntry(day, requisitionRef, hotelTimeZone)),
      payPreview: detail.payPreview,
    })
  }

  /* Quien está asignado (ACTIVE) pero no tiene fila esta semana: sin esto
     no hay forma de saber que alguien no ponchó NI UN SOLO día — nunca
     aparecía (Hugo, 2026-10-13). Sin asignación activa no hay de quién
     esperar horas esta semana, así que no se le inventa una fila. */
  const coveredWorkerIds = new Set(rows.map((row) => row.workerId))
  for (const worker of workers) {
    if (coveredWorkerIds.has(worker.id) || worker.assignment === null) continue
    const { requisitionId, hotelName } = worker.assignment
    const requisitionRef = requisitionRefOf(requisitionIndex, requisitionId)
    rows.push({
      timesheetId: `virtual:${worker.id}:${weekStart}`,
      requisitionId,
      workerId: worker.id,
      workerName: worker.fullName,
      jobTitle: worker.position?.name ?? '—',
      photoUrl: worker.photoUrl,
      hotelName: requisitionIndex.get(requisitionId)?.hotelName ?? hotelName,
      /* Sin timesheet real no llega por `/timesheets`: sin id de hotel por
         aquí. Cualquier otra fila del mismo hotel ya lo trae. */
      hotelId: null,
      /* No hay timesheet real: nada que enviar ni aprobar todavía. */
      weekStatus: NO_TIMESHEET_STATUS,
      totalHours: 0,
      targetHours: null,
      overtimeHours: null,
      entries: days.map((date) => emptyEntry(date, requisitionRef)),
    })
  }

  const requisitionNumbers = [
    ...new Set(rows.flatMap((row) => row.entries.map((entry) => entry.requisitionNumber ?? ''))),
  ].filter(Boolean)

  /* Búsqueda, requisición y hotel NUNCA viajan al servidor (solo `status`
     lo hace, arriba) — filtrar aquí adentro los dejaba atados a la LLAVE de
     caché de la consulta (ver `serializeQueryArgs`), así que elegir un hotel
     repetía TODO el trabajo de arriba (/timesheets, /me, las páginas de
     /workers) para, al final, aplicar un filtro que no necesitaba ni un solo
     byte nuevo del servidor (Hugo, 2026-10-14, "por qué tarda en cargar").
     Ahora se devuelven TODAS las filas sin filtrar; filtrarlas es trabajo
     de quien las pinta (`TimesheetPage`/`TimesheetGlobalPage`). */
  return {
    data: {
      days,
      rows,
      requisitionNumbers,
      hotelNames: [...new Set(rows.map((row) => row.hotelName))].filter((name) => name !== '—'),
      weekStart,
      availableWeeks,
    },
  }
}

/** Misma búsqueda/requisición/hotel que antes vivía dentro de `fetchWeek`,
    ahora aplicada por quien consume `TimesheetWeek.rows` — así cambiar un
    filtro cliente no dispara una red nueva (ver el comentario de arriba). */
export function filterTimesheetRows(
  rows: TimesheetRow[],
  filters: Pick<TimesheetFilters, 'search' | 'requisitionNumber' | 'hotelName'>,
): TimesheetRow[] {
  return rows.filter((row) => {
    if (filters.search && !row.workerName.toLowerCase().includes(filters.search.toLowerCase())) {
      return false
    }
    if (
      filters.requisitionNumber !== ANY_VALUE &&
      !row.entries.some((entry) => entry.requisitionNumber === filters.requisitionNumber)
    ) {
      return false
    }
    if (filters.hotelName !== ANY_VALUE && row.hotelName !== filters.hotelName) return false
    return true
  })
}

/**
 * La CINTA continua de la vista Días: TODAS las semanas cargadas de una vez,
 * con las filas fusionadas por persona × requisición y sus días en una sola
 * línea de tiempo. Navegar de semana ya no refetchea nada — solo mueve la
 * ventana — y por eso las fechas vecinas pueden entrar EN VIVO al arrastrar.
 * ⚠ El caller debe pasar `weekStart: ANY_VALUE` para que la llave de caché no
 * cambie al navegar.
 */
async function fetchTimeline(
  fetchWithBQ: FetchWithBQ,
  filters: TimesheetFilters,
): Promise<{ data: TimesheetTimeline } | { error: unknown }> {
  const [listRes, meRes, workersRes, requisitionIndex] = await Promise.all([
    fetchWithBQ({
      url: '/timesheets',
      params: paramsDe(filters),
    }),
    withSharedFetchCache('timesheet:me', () => fetchWithBQ('/me')),
    /* Composición D-28: `/workers` trae la foto Y el puesto de la persona; el
       índice de requisiciones trae folio real y hotel (nombre + foto, D-34).
       Si algo de esto falla, la fila degrada con fallbacks (criterio D-30).
       Misma caché compartida que `fetchWeek` — mismos tres recursos, mismo
       motivo para no repetirlos. */
    withSharedFetchCache('timesheet:workers', () =>
      fetchAllPages<WorkerApi>(fetchWithBQ, '/workers'),
    ),
    withSharedFetchCache('timesheet:requisitions', () => fetchRequisitionIndex(fetchWithBQ)),
  ])
  if (listRes.error) return { error: listRes.error }
  if (meRes.error) return { error: meRes.error }

  const timesheets = enElPeriodo((listRes.data as ApiEnvelope<TimesheetApi[]>).data, filters)
  const me = (meRes.data as ApiEnvelope<{ hotel: { name: string } | null }>).data
  const fallbackHotel = me.hotel?.name ?? '—'

  const workerInfo = new Map<string, { photoUrl: string | null; jobTitle: string }>()
  if (!('error' in workersRes)) {
    for (const worker of workersRes.data) {
      workerInfo.set(worker.id, {
        photoUrl: worker.photoUrl,
        jobTitle: worker.position?.name ?? '—',
      })
    }
  }

  /* Mismo lunes que `fetchWeek` (Hugo, 2026-10-13): si solo uno de los dos
     incluyera la semana en curso, `TimesheetPage` —que arma su navegador de
     esta cinta cuando ya cargó, y de `fetchWeek` mientras tanto— mostraría
     un encabezado y una tabla de semanas distintas sin que nada avisara. */
  const availableWeeks = [
    ...new Set([...timesheets.map((sheet) => sheet.weekStart), currentWeekMonday()]),
  ].sort()
  const firstWeek = availableWeeks[0] as string
  const lastWeek = availableWeeks[availableWeeks.length - 1] as string
  const totalDays =
    Math.round(
      (new Date(`${lastWeek}T00:00:00Z`).getTime() - new Date(`${firstWeek}T00:00:00Z`).getTime()) /
        MS_PER_DAY,
    ) + 7
  const days = Array.from({ length: totalDays }, (_item, index) => addDaysIso(firstWeek, index))

  const details = await Promise.all(
    timesheets.map((sheet) => fetchWithBQ(`/timesheets/${sheet.id}`)),
  )

  /** Fusión por persona × requisición: una fila, todas sus semanas. */
  const rows = new Map<string, TimelineRow>()
  for (const [index, sheet] of timesheets.entries()) {
    const detailRes = details[index]
    if (!detailRes || detailRes.error) continue
    const detail = (detailRes.data as ApiEnvelope<TimesheetApi>).data
    const requisitionRef = requisitionRefOf(requisitionIndex, detail.requisitionId)
    const requisitionInfo = requisitionIndex.get(detail.requisitionId)

    const key = `${detail.worker.id}|${detail.requisitionId}`
    const row = rows.get(key) ?? {
      workerId: detail.worker.id,
      requisitionId: detail.requisitionId,
      assignment: detail.assignment,
      workerName: detail.worker.fullName,
      jobTitle: workerInfo.get(detail.worker.id)?.jobTitle ?? '—',
      /* El hotel es el de LA REQUISICIÓN de la fila, no el de quien mira: con
         un rol multi-hotel, cada fila dice el suyo y el filtro sirve. */
      hotelName: requisitionInfo?.hotelName ?? fallbackHotel,
      hotelPhotoUrl: requisitionInfo?.hotelPhotoUrl ?? null,
      photoUrl: workerInfo.get(detail.worker.id)?.photoUrl ?? null,
      entries: [],
      byWeek: {},
    }
    row.entries.push(
      ...(detail.days ?? []).map((day) =>
        toEntry(day, requisitionRef, requisitionInfo?.hotelTimeZone),
      ),
    )
    row.byWeek[sheet.weekStart] = {
      timesheetId: sheet.id,
      weekStatus: detail.status,
      totalHours: Math.round(((detail.totals?.netMinutes ?? 0) / 60) * 100) / 100,
    }
    rows.set(key, row)
  }

  const allRows = [...rows.values()]
  const requisitionNumbers = [
    ...new Set(allRows.flatMap((row) => row.entries.map((entry) => entry.requisitionNumber ?? ''))),
  ].filter(Boolean)

  const visible = allRows.filter((row) => {
    if (filters.search && !row.workerName.toLowerCase().includes(filters.search.toLowerCase())) {
      return false
    }
    if (
      filters.requisitionNumber !== ANY_VALUE &&
      !row.entries.some((entry) => entry.requisitionNumber === filters.requisitionNumber)
    ) {
      return false
    }
    if (filters.hotelName !== ANY_VALUE && row.hotelName !== filters.hotelName) return false
    return true
  })

  return {
    data: {
      days,
      rows: visible,
      availableWeeks,
      requisitionNumbers,
      hotelNames: [...new Set(allRows.map((row) => row.hotelName))].filter((name) => name !== '—'),
    },
  }
}

/**
 * El agregado del MES de la semana elegida: cuántas jornadas, horas y estados
 * hay por fecha. Junta los timesheets cuyas semanas tocan el mes y suma sus
 * días — mismo contrato, otra densidad (la vista Mes).
 */
async function fetchMonth(
  fetchWithBQ: FetchWithBQ,
  filters: TimesheetFilters,
): Promise<{ data: TimesheetMonth } | { error: unknown }> {
  const [listRes, requisitionIndex] = await Promise.all([
    fetchWithBQ({
      url: '/timesheets',
      params: paramsDe(filters),
    }),
    withSharedFetchCache('timesheet:requisitions', () => fetchRequisitionIndex(fetchWithBQ)),
  ])
  if (listRes.error) return { error: listRes.error }

  const timesheets = enElPeriodo((listRes.data as ApiEnvelope<TimesheetApi[]>).data, filters)
  if (timesheets.length === 0) return { data: { month: '', days: [] } }

  const availableWeeks = [...new Set(timesheets.map((sheet) => sheet.weekStart))].sort()
  /** El mes de la semana es el de su JUEVES (ISO 8601): una semana partida
      entre dos meses pertenece al que tiene la mayoría de sus días. */
  const month = addDaysIso(resolveWeek(availableWeeks, filters.weekStart) as string, 3).slice(0, 7)
  const ofMonth = timesheets.filter(
    (sheet) => sheet.weekStart.slice(0, 7) === month || sheet.weekEnd.slice(0, 7) === month,
  )

  const details = await Promise.all(ofMonth.map((sheet) => fetchWithBQ(`/timesheets/${sheet.id}`)))

  const byDate = new Map<string, TimesheetMonthDay>()
  for (const detailRes of details) {
    if (detailRes.error) continue
    const detail = (detailRes.data as ApiEnvelope<TimesheetApi>).data
    if (
      filters.search &&
      !detail.worker.fullName.toLowerCase().includes(filters.search.toLowerCase())
    ) {
      continue
    }
    const requisitionRef = requisitionRefOf(requisitionIndex, detail.requisitionId)
    if (filters.requisitionNumber !== ANY_VALUE && requisitionRef !== filters.requisitionNumber) {
      continue
    }

    for (const day of detail.days ?? []) {
      if (day.workDate.slice(0, 7) !== month) continue
      const aggregate = byDate.get(day.workDate) ?? {
        date: day.workDate,
        netHours: 0,
        people: 0,
        pending: 0,
        observed: 0,
        reviewed: 0,
        absences: 0,
      }
      aggregate.people += 1
      if (day.isAbsence) aggregate.absences += 1
      else aggregate.netHours += day.netMinutes / 60
      const status = dayStatus(day)
      if (status === 'PENDING') aggregate.pending += 1
      else if (status === 'OBSERVED') aggregate.observed += 1
      else aggregate.reviewed += 1
      byDate.set(day.workDate, aggregate)
    }
  }

  const days = [...byDate.values()]
    .map((day) => ({ ...day, netHours: Math.round(day.netHours * 100) / 100 }))
    .sort((first, second) => (first.date < second.date ? -1 : 1))

  return { data: { month, days } }
}

export const timesheetApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTimesheetWeek: build.query<TimesheetWeek, TimesheetFilters>({
      queryFn: async (filters, _api, _extra, fetchWithBQ) => {
        const result = await fetchWeek(fetchWithBQ as FetchWithBQ, filters)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      /* `search`/`requisitionNumber`/`hotelName` no afectan lo que se pide
         (solo `status` sí, dentro de `fetchWeek`): que formaran parte de la
         llave de caché hacía que elegir un hotel disparara la MISMA red
         pesada de cero (Hugo, 2026-10-14). Misma semana y mismo estado =
         mismos datos; filtrarlos es cosa de quien los pinta. */
      serializeQueryArgs: ({ queryArgs }) => `${queryArgs.weekStart}|${queryArgs.status}`,
      providesTags: [{ type: 'Timesheet' as const, id: 'LIST' }],
    }),

    getTimesheetTimeline: build.query<TimesheetTimeline, TimesheetFilters>({
      queryFn: async (filters, _api, _extra, fetchWithBQ) => {
        const result = await fetchTimeline(fetchWithBQ as FetchWithBQ, filters)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: [{ type: 'Timesheet' as const, id: 'LIST' }],
    }),

    getTimesheetMonth: build.query<TimesheetMonth, TimesheetFilters>({
      queryFn: async (filters, _api, _extra, fetchWithBQ) => {
        const result = await fetchMonth(fetchWithBQ as FetchWithBQ, filters)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: [{ type: 'Timesheet' as const, id: 'LIST' }],
    }),

    /**
     * El paso del Supervisor (D-09): resuelve el día con su nota. Aprobar no
     * está aquí — le da 403 a propósito; eso es del Manager de Área o el GM.
     */
    reviewTimesheetDay: build.mutation<unknown, ReviewDayRequest>({
      query: ({ dayId, note }) => ({
        url: `/timesheet-days/${dayId}/review`,
        method: 'POST',
        body: { note },
      }),
      invalidatesTags: [{ type: 'Timesheet' as const, id: 'LIST' }],
    }),

    /** El Supervisor manda la semana a revisión; el back la frena si quedan anomalías. */
    submitTimesheet: build.mutation<unknown, string>({
      query: (timesheetId) => ({ url: `/timesheets/${timesheetId}/submit`, method: 'POST' }),
      invalidatesTags: [{ type: 'Timesheet' as const, id: 'LIST' }],
    }),

    /** Aprobar es del Manager de Área (su depto) o General (D-09): al resto, 403. */
    approveTimesheet: build.mutation<unknown, string>({
      query: (timesheetId) => ({ url: `/timesheets/${timesheetId}/approve`, method: 'POST' }),
      invalidatesTags: [{ type: 'Timesheet' as const, id: 'LIST' }],
    }),

    /**
     * Marca manual: el DTO real pide el ASSIGNMENT, que el timesheet no trae —
     * se resuelve aquí buscando la asignación del colaborador en la requisición
     * de la fila (patrón D-28), y el motivo es obligatorio.
     */
    createManualPunch: build.mutation<unknown, ManualPunchRequest>({
      queryFn: async (request, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ
        const assignmentsRes = await bq(`/requisitions/${request.requisitionId}/assignments`)
        if (assignmentsRes.error) return { error: assignmentsRes.error as never }

        const assignments = (
          assignmentsRes.data as ApiEnvelope<Array<{ id: string; worker: { id: string } }>>
        ).data
        const assignment = assignments.find((item) => item.worker.id === request.workerId)
        if (!assignment) {
          return {
            error: {
              status: 404,
              data: {
                error: {
                  code: 'ASSIGNMENT_NOT_FOUND',
                  /* Se traduce AL LLAMAR, no al cargar: sigue al idioma en caliente (D-36). */
                  message: i18n._(msg`El colaborador no tiene asignación en esta requisición`),
                },
              },
            } as never,
          }
        }

        const punchRes = await bq({
          url: '/punches/manual',
          method: 'POST',
          body: {
            assignmentId: assignment.id,
            type: request.type,
            workDate: request.workDate,
            occurredAt: request.occurredAt,
            reason: request.reason,
          },
        })
        if (punchRes.error) return { error: punchRes.error as never }
        return { data: null }
      },
      invalidatesTags: [{ type: 'Timesheet' as const, id: 'LIST' }],
    }),

    /**
     * Corregir una marca YA registrada — distinto de `createManualPunch`,
     * que captura la que falta. `timesheet:correct_punch`, del Manager de
     * Área/General (Hugo, 2026-10-10).
     */
    correctPunch: build.mutation<unknown, CorrectPunchRequest>({
      query: (request) => ({
        url: `/punches/${request.punchId}`,
        method: 'PATCH',
        body: { occurredAt: request.occurredAt, reason: request.reason },
      }),
      invalidatesTags: [{ type: 'Timesheet' as const, id: 'LIST' }],
    }),

    /** Catálogo del Administrador: Descanso, OFF… para marcar un día sin
        ponches antes de aprobar (Hugo, 2026-10-12). */
    getTimesheetDayStatuses: build.query<CatalogItemApi[], void>({
      query: () => '/catalogs/timesheet-day-statuses',
      transformResponse: (res: ApiEnvelope<CatalogItemApi[]>) => res.data,
      providesTags: [{ type: 'Catalog' as const, id: 'TIMESHEET_DAY_STATUSES' }],
    }),

    /**
     * `dayStatusId: null` quita la marca — el día vuelve a "sin marcar". Sin
     * `invalidatesTags`: eso recargaba la TABLA entera (`getTimesheetWeek`
     * compone 1 + N llamadas) y de paso perdía a quién tenías seleccionado en
     * la lista — Hugo, 2026-10-12: "debería recargar el campo, no toda la
     * tabla". Se parchea el caché en el lugar: solo ese día, de esa fila.
     */
    setTimesheetDayStatus: build.mutation<
      TimesheetDayApi,
      { timesheetId: string; workDate: string; dayStatusId: string | null }
    >({
      query: ({ timesheetId, ...body }) => ({
        url: `/timesheets/${timesheetId}/day-status`,
        method: 'PUT',
        body,
      }),
      transformResponse: (res: ApiEnvelope<TimesheetDayApi>) => res.data,
      onQueryStarted: async (arg, lifecycleApi) => {
        const { dispatch, queryFulfilled } = lifecycleApi
        const day = await queryFulfilled.then(
          (res) => res.data,
          () => null,
        )
        if (!day) return

        const cachedArgs = timesheetApi.util.selectCachedArgsForQuery(
          lifecycleApi.getState(),
          'getTimesheetWeek',
        )
        for (const cachedArg of cachedArgs) {
          dispatch(
            timesheetApi.util.updateQueryData('getTimesheetWeek', cachedArg, (draft) => {
              const row = draft.rows.find((r) => r.timesheetId === arg.timesheetId)
              const entry = row?.entries.find((e) => e.date === arg.workDate)
              if (entry) entry.dayStatus = day.dayStatus
            }),
          )
        }
      },
    }),
  }),
})

export interface ManualPunchRequest {
  requisitionId: string
  workerId: string
  type: 'CLOCK_IN' | 'LUNCH_OUT' | 'LUNCH_IN' | 'CLOCK_OUT'
  /** ISO sin hora: el día al que pertenece la marca. */
  workDate: string
  /** ISO completo: cuándo ocurrió de verdad, según quien la captura. */
  occurredAt: string
  reason: string
}

export interface CorrectPunchRequest {
  punchId: string
  /** ISO completo: la hora real, corrigiendo lo que ya se había registrado. */
  occurredAt: string
  reason: string
}

export const {
  useGetTimesheetWeekQuery,
  useGetTimesheetTimelineQuery,
  useGetTimesheetMonthQuery,
  useReviewTimesheetDayMutation,
  useSubmitTimesheetMutation,
  useApproveTimesheetMutation,
  useCreateManualPunchMutation,
  useCorrectPunchMutation,
  useGetTimesheetDayStatusesQuery,
  useSetTimesheetDayStatusMutation,
} = timesheetApi
