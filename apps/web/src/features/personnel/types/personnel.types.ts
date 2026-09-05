/**
 * Mi Personal (Supervisor): los colaboradores asignados a sus requisiciones,
 * con su semáforo SIEMPRE visible, su turno de hoy y sus marcas.
 */

/**
 * Desempeño de la SEMANA, derivado solo de hechos: turnos del Schedule y
 * marcas del ponche. Cada eje es 0–100; `null` = esa medida aún no se puede
 * calcular (sin días comparables). Nada se inventa (regla de la casa).
 */
export interface PersonnelPerformance {
  /** Días con marcas de los días con turno ya pasados. */
  attendance: number | null
  /** Entradas a tiempo (≤ 10 min tarde) de las entradas con turno. */
  punctuality: number | null
  /** Días con entrada Y salida de los días con marcas. */
  completeness: number | null
  /** Marcas dentro de la geocerca, de las que traen el dato (D-08). */
  geofence: number | null
  /** Días sin anomalía de los días con marcas. */
  cleanDays: number | null
}

export interface PersonnelRow {
  workerId: string
  fullName: string
  photoUrl: string | null
  phone: string
  positionName: string
  stateCode: string
  /** Turno de HOY del Schedule; `null` = descansa (o su estado lo explica). */
  shift: { startsAt: string; endsAt: string } | null
  /** Primera marca CLOCK_IN de hoy; `null` = sin entrada registrada. */
  clockInAt: string | null
  /** Stand-by solo aplica desde estados operativos (seed del semáforo). */
  canStandBy: boolean
  /** La semana medida en hechos; `null` = sin datos suficientes todavía. */
  performance: PersonnelPerformance | null
  /** Su ficha personal, tal cual la sirve /workers (alcance staff:read). */
  personal: {
    age: number
    gender: string
    zoneName: string
    englishLevel: string | null
    hiringModality: string | null
    transportType: string | null
    bloodType: string | null
    emergencyContact: { name: string; phone: string; relationship: string } | null
  }
}

export interface PersonnelBoard {
  rows: PersonnelRow[]
  assignedToday: number
  clockedInToday: number
  inStandBy: number
  inAccident: number
}
