/**
 * Mi Personal (Supervisor): los colaboradores asignados a sus requisiciones,
 * con su semáforo SIEMPRE visible, su turno de hoy y sus marcas.
 */

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
}

export interface PersonnelBoard {
  rows: PersonnelRow[]
  assignedToday: number
  clockedInToday: number
  inStandBy: number
  inAccident: number
}
