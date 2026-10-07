import { msg } from '@lingui/core/macro'

import type { Punch } from '../types/observability.types'

import { type Kpi, ratioOf } from './kpi'
import { isInPeriod, localDay, type Period } from './period'

import type { WorkerApi } from '@/shared/types/apiContract.types'

const SHORT_LUNCH_MIN = 15
const LONG_LUNCH_MIN = 30
const SHORT_SHIFT_HOURS = 4

/** Las marcas de una persona en un día del hotel. */
export interface Shift {
  workerId: string
  hotelId: string
  day: string
  /** Ordenadas por hora. */
  punches: Punch[]
}

/** Agrupa por persona, hotel y día local del hotel (un ponche se lee donde ocurrió). */
export function groupShifts(punches: Punch[]): Shift[] {
  const shifts = new Map<string, Shift>()
  for (const punch of punches) {
    const day = localDay(punch.serverAt, punch.hotelTimeZone)
    const key = `${punch.workerId}|${punch.hotelId}|${day}`
    const shift = shifts.get(key) ?? {
      workerId: punch.workerId,
      hotelId: punch.hotelId,
      day,
      punches: [],
    }
    shift.punches.push(punch)
    shifts.set(key, shift)
  }
  for (const shift of shifts.values()) {
    shift.punches.sort((a, b) => a.serverAt.localeCompare(b.serverAt))
  }
  return [...shifts.values()]
}

function first(shift: Shift, type: Punch['type']): Punch | undefined {
  return shift.punches.find((punch) => punch.type === type)
}

function minutesBetween(a: Punch, b: Punch): number {
  return (new Date(b.serverAt).getTime() - new Date(a.serverAt).getTime()) / 60_000
}

/** Entrada y salida, y cada salida a comer con su regreso. */
export function isComplete(shift: Shift): boolean {
  const count = (type: Punch['type']): number =>
    shift.punches.filter((punch) => punch.type === type).length
  return count('CLOCK_IN') > 0 && count('CLOCK_OUT') > 0 && count('LUNCH_OUT') === count('LUNCH_IN')
}

/** Minutos de comida (salida → regreso); `null` si no comió o falta una marca. */
export function lunchMinutes(shift: Shift): number | null {
  const out = first(shift, 'LUNCH_OUT')
  const back = first(shift, 'LUNCH_IN')
  return out && back ? minutesBetween(out, back) : null
}

/** Dos marcas seguidas en menos de un minuto: salir y volver sin moverse. */
export function hasSameMinute(shift: Shift): boolean {
  return shift.punches.some(
    (punch, index) => index > 0 && minutesBetween(shift.punches[index - 1] as Punch, punch) < 1,
  )
}

export interface WorkerInput {
  period: Period
  /** Solo los del periodo. */
  punches: Punch[]
  workers: WorkerApi[]
}

export function workerKpis(input: WorkerInput): Kpi[] {
  const { period } = input
  const punches = input.punches.filter((punch) => isInPeriod(punch.serverAt, period))
  const shifts = groupShifts(punches)

  /* Hoy todavía no termina: una jornada de hoy sin salida no está incompleta. */
  const isToday = (shift: Shift): boolean =>
    shift.day === localDay(period.to.toISOString(), shift.punches[0]?.hotelTimeZone)
  const finished = shifts.filter((shift) => !isToday(shift))
  const inProgress = shifts.filter(
    (shift) => isToday(shift) && first(shift, 'CLOCK_IN') && !first(shift, 'CLOCK_OUT'),
  )
  const complete = finished.filter(isComplete)

  const lunches = shifts.flatMap((shift) => {
    const minutes = lunchMinutes(shift)
    return minutes === null ? [] : [minutes]
  })
  const shortShifts = complete.filter((shift) => {
    const clockIn = first(shift, 'CLOCK_IN') as Punch
    const clockOut = first(shift, 'CLOCK_OUT') as Punch
    return minutesBetween(clockIn, clockOut) < SHORT_SHIFT_HOURS * 60
  })

  const withGeofence = punches.filter((punch) => punch.insideGeofence !== null)
  const outside = withGeofence.filter((punch) => punch.insideGeofence === false)
  const manual = punches.filter((punch) => punch.isManual)

  /* La puntualidad sale de `lateMinutes`, que solo existe con un turno
     programado ese día. Sin tolerancia inventada: a tiempo es no tarde. */
  const scheduledIns = punches.filter(
    (punch) => punch.type === 'CLOCK_IN' && punch.lateMinutes !== null,
  )
  const onTime = scheduledIns.filter((punch) => (punch.lateMinutes as number) <= 0)

  const blacklisted = input.workers.filter((worker) => worker.state.code === 'BLACK')
  const completeProfile = input.workers.filter((worker) => worker.isProfileComplete)

  return [
    {
      id: 'workerShiftsInProgress',
      label: msg`Jornadas en curso`,
      hint: msg`Personas que poncharon entrada hoy y todavía no su salida.`,
      format: 'count',
      scope: 'NOW',
      value: inProgress.length,
    },
    {
      id: 'workerCompleteShifts',
      label: msg`Jornadas completas`,
      hint: msg`Jornadas con entrada, salida y regreso de cada comida, sin contar las de hoy.`,
      format: 'percent',
      scope: 'PERIOD',
      ...ratioOf(complete.length, finished.length),
    },
    {
      id: 'workerShortLunch',
      label: msg`Comida de menos de ${SHORT_LUNCH_MIN} min`,
      hint: msg`Jornadas cuya comida duró menos de ${SHORT_LUNCH_MIN} minutos.`,
      format: 'count',
      scope: 'PERIOD',
      value: lunches.filter((minutes) => minutes < SHORT_LUNCH_MIN).length,
    },
    {
      id: 'workerLongLunch',
      label: msg`Comida de más de ${LONG_LUNCH_MIN} min`,
      hint: msg`Jornadas cuya comida duró más de ${LONG_LUNCH_MIN} minutos.`,
      format: 'count',
      scope: 'PERIOD',
      value: lunches.filter((minutes) => minutes > LONG_LUNCH_MIN).length,
    },
    {
      id: 'workerSameMinute',
      label: msg`Marcas en el mismo minuto`,
      hint: msg`Jornadas con dos marcas seguidas en menos de un minuto.`,
      format: 'count',
      scope: 'PERIOD',
      value: shifts.filter(hasSameMinute).length,
    },
    {
      id: 'workerShortShifts',
      label: msg`Jornadas de menos de ${SHORT_SHIFT_HOURS} h`,
      hint: msg`Jornadas completas de menos de ${SHORT_SHIFT_HOURS} horas entre entrada y salida.`,
      format: 'count',
      scope: 'PERIOD',
      value: shortShifts.length,
    },
    {
      id: 'workerOutsideGeofence',
      label: msg`Ponches fuera de geocerca`,
      hint: msg`Ponches registrados fuera del radio del hotel.`,
      format: 'count',
      scope: 'PERIOD',
      value: outside.length,
      ratio: { part: outside.length, whole: withGeofence.length },
    },
    {
      id: 'workerManual',
      label: msg`Ponches manuales`,
      hint: msg`Ponches capturados a mano en lugar de con el teléfono.`,
      format: 'percent',
      scope: 'PERIOD',
      ...ratioOf(manual.length, punches.length),
    },
    {
      id: 'workerPunctuality',
      label: msg`Puntualidad`,
      hint: msg`Entradas a la hora o antes, de las que tenían un turno programado.`,
      format: 'percent',
      scope: 'PERIOD',
      ...(scheduledIns.length === 0
        ? { value: null, empty: 'NO_SOURCE' as const }
        : ratioOf(onTime.length, scheduledIns.length)),
    },
    {
      id: 'workerBlacklist',
      label: msg`Blacklist`,
      hint: msg`Colaboradores en Blacklist sobre todo el Pool.`,
      format: 'percent',
      scope: 'NOW',
      ...ratioOf(blacklisted.length, input.workers.length),
    },
    {
      id: 'workerCompleteProfile',
      label: msg`Expedientes completos`,
      hint: msg`Colaboradores con el perfil completo sobre todo el Pool.`,
      format: 'percent',
      scope: 'NOW',
      ...ratioOf(completeProfile.length, input.workers.length),
    },
  ]
}
