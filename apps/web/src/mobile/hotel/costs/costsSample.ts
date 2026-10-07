import type {
  CostGap,
  HotelCostPositionApi,
  HotelCostPositionsResponse,
  HotelCostWeekApi,
  HotelCostWeeksResponse,
} from './costsContract'

/**
 * DATOS DE EJEMPLO — ficticios — para ver cómo queda la sección de costos
 * mientras el backend no publica `/hotel-costs`. Se generan a partir de la
 * fecha de hoy (semanas de lunes a domingo) para que «esta semana» siempre sea
 * la actual. La pantalla los marca como ejemplo: nunca pasan por datos reales.
 */

const MS_PER_DAY = 86_400_000
const WEEKS = 8

interface SamplePosition {
  id: string
  name: string
  department: string
  /** `null` = la posición no tiene tarifa en el contrato (información incompleta). */
  billRate: number | null
  workers: number
  /** Horas regulares por persona en una semana completa. */
  hoursPerWorker: number
}

const POSITIONS: readonly SamplePosition[] = [
  {
    id: 'cp-camarista',
    name: 'Camarista',
    department: 'Housekeeping',
    billRate: 18.5,
    workers: 6,
    hoursPerWorker: 38,
  },
  {
    id: 'cp-ayudante',
    name: 'Ayudante general',
    department: 'Mantenimiento',
    billRate: 16,
    workers: 3,
    hoursPerWorker: 40,
  },
  {
    id: 'cp-tecnico',
    name: 'Técnico de mantenimiento',
    department: 'Mantenimiento',
    billRate: 22,
    workers: 2,
    hoursPerWorker: 42,
  },
  {
    id: 'cp-lavanderia',
    name: 'Lavandería',
    department: 'Housekeeping',
    billRate: 17,
    workers: 2,
    hoursPerWorker: 36,
  },
  {
    id: 'cp-supervisor',
    name: 'Supervisor de piso',
    department: 'Housekeeping',
    billRate: null,
    workers: 1,
    hoursPerWorker: 40,
  },
]

const OVERTIME_MULTIPLIER = 1.5

function iso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** El lunes de la semana de `date` (UTC). */
function mondayOf(date: Date): Date {
  const day = date.getUTCDay()
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  monday.setTime(monday.getTime() - ((day + 6) % 7) * MS_PER_DAY)
  return monday
}

/** Variación estable por semana y posición (sin azar: la misma semana da lo mismo siempre). */
function wiggle(weekIndex: number, positionIndex: number): number {
  return ((weekIndex * 7 + positionIndex * 13) % 9) - 4
}

function money(value: number): string {
  return value.toFixed(2)
}

/** El desglose de una semana: `weekIndex` 0 = la actual, 1 = la anterior… */
function positionsFor(weekIndex: number, today: Date): HotelCostPositionApi[] {
  /* La semana actual va a la mitad: lo ponchado hasta hoy. */
  const elapsed = weekIndex === 0 ? Math.min(((today.getUTCDay() + 6) % 7) + 1, 7) / 7 : 1
  /* La posición sin tarifa entró hace tres semanas: las anteriores salen completas. */
  const active = POSITIONS.filter((position) => position.billRate !== null || weekIndex <= 2)
  return active.map((position, positionIndex) => {
    const hours = Math.max(
      0,
      (position.hoursPerWorker + wiggle(weekIndex, positionIndex)) * elapsed,
    )
    const regular = Math.min(hours, 40 * elapsed)
    const overtime = Math.max(0, hours - regular)
    const regularMinutes = Math.round(regular * 60 * position.workers)
    const overtimeMinutes = Math.round(overtime * 60 * position.workers)
    const gaps: CostGap[] = []
    if (position.billRate === null) gaps.push('POSITION_WITHOUT_RATE')
    if (weekIndex === 0) gaps.push('UNAPPROVED_HOURS')
    const cost =
      position.billRate === null
        ? null
        : money(
            (regularMinutes / 60) * position.billRate +
              (overtimeMinutes / 60) * position.billRate * OVERTIME_MULTIPLIER,
          )
    return {
      catalogPositionId: position.id,
      positionName: position.name,
      departmentName: position.department,
      workers: position.workers,
      regularMinutes,
      overtimeMinutes,
      billRate: position.billRate === null ? null : money(position.billRate),
      overtimeMultiplier: position.billRate === null ? null : money(OVERTIME_MULTIPLIER),
      cost,
      status: gaps.length === 0 ? 'COMPLETE' : 'INCOMPLETE',
      gaps,
    }
  })
}

function weekBounds(weekIndex: number, today: Date): { weekStart: string; weekEnd: string } {
  const start = new Date(mondayOf(today).getTime() - weekIndex * 7 * MS_PER_DAY)
  return { weekStart: iso(start), weekEnd: iso(new Date(start.getTime() + 6 * MS_PER_DAY)) }
}

export function sampleCostWeeks(today: Date = new Date()): HotelCostWeeksResponse {
  const weeks: HotelCostWeekApi[] = Array.from({ length: WEEKS }, (_item, weekIndex) => {
    const positions = positionsFor(weekIndex, today)
    const priced = positions.filter((position) => position.cost !== null)
    const total = priced.reduce((sum, position) => sum + Number(position.cost), 0)
    const gaps = [...new Set(positions.flatMap((position) => position.gaps))]
    return {
      ...weekBounds(weekIndex, today),
      isCurrent: weekIndex === 0,
      regularMinutes: positions.reduce((sum, position) => sum + position.regularMinutes, 0),
      overtimeMinutes: positions.reduce((sum, position) => sum + position.overtimeMinutes, 0),
      approvedCost: weekIndex === 0 ? null : money(total),
      estimatedCost: money(total),
      status: gaps.length === 0 ? 'COMPLETE' : 'INCOMPLETE',
      gaps,
    }
  })
  return { currency: 'USD', weeks }
}

export function sampleCostPositions(
  weekStart: string,
  today: Date = new Date(),
): HotelCostPositionsResponse {
  const currentMonday = mondayOf(today).getTime()
  const weekIndex = Math.max(
    0,
    Math.round((currentMonday - new Date(`${weekStart}T00:00:00Z`).getTime()) / (7 * MS_PER_DAY)),
  )
  return {
    currency: 'USD',
    ...weekBounds(weekIndex, today),
    positions: positionsFor(weekIndex, today),
  }
}
