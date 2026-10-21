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
  /**
   * `null` cuando `/workers` sirvió "lo básico" en vez de la ficha completa
   * (Hugo, 2026-10-12: el Hotel ya no ve el semáforo) — no debería pasar en
   * Mi Personal mismo (es `staff:read`, justo el alcance reducido), así que
   * HOY esto es casi siempre `null`; ver el hallazgo en la bitácora.
   */
  stateCode: string | null
  /**
   * La zona del hotel del turno: sus horas se leen donde ocurren.
   *
   * Viaja con la fila y no se toma de la sesión a propósito — así el dato es
   * correcto para cualquiera que lo consuma, y no depende de quién mira.
   */
  hotelTimeZone: string | undefined
  /** Primera marca CLOCK_IN de hoy; `null` = sin entrada registrada. */
  clockInAt: string | null
  /** Stand-by solo aplica desde estados operativos (seed del semáforo). */
  canStandBy: boolean
  /** Reportar (Rojo) igual: solo desde estados operativos (seed del semáforo). */
  canReport: boolean
  /** La semana medida en hechos; `null` = sin datos suficientes todavía. */
  performance: PersonnelPerformance | null
  /** Su última Inspección de Presentación Personal (Supervisor); `null` = nunca inspeccionado. */
  presentationAudit: { score: number; auditedAt: string } | null
  /** Su ficha personal, tal cual la sirve /workers (alcance staff:read). */
  personal: {
    /** `null` si /workers no trajo la ficha completa (ver `stateCode`). */
    age: number | null
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
  clockedInToday: number
  inStandBy: number
  inAccident: number
}
