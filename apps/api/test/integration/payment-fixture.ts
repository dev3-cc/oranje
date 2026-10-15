import { v7 as uuidv7 } from 'uuid'

import { db } from './db.js'

/**
 * Lo que necesitan las pruebas de pago y aprobación: hoteles, requisiciones,
 * turnos, colaboradores y hojas de horas. Cada cosa que se crea se anota y
 * `cleanup` la borra en orden inverso: la base es la de desarrollo, compartida
 * con las demás suites, y no debe quedar basura.
 */

export interface Registry {
  rows: Array<{ table: string; id: string }>
}

export async function lookups(): Promise<{
  zoneId: string
  positionId: string
  modalityId: string
  departmentId: string
  coverageStateId: string
  reqStateId: string
  workerStateId: string
}> {
  const zone = await db.zone.findFirstOrThrow({ select: { id: true } })
  const position = await db.catalogPosition.findFirstOrThrow({ select: { id: true } })
  const modality = await db.hiringModality.findFirstOrThrow({ select: { id: true } })
  const department = await db.hotelDepartment.findFirstOrThrow({ select: { id: true } })
  const coverage = await db.statusLightState.findFirstOrThrow({
    where: { code: 'GREEN', statusLightCode: 'POSITION_COVERAGE' },
    select: { id: true },
  })
  const reqState = await db.statusLightState.findFirstOrThrow({
    where: { code: 'LIGHT_BLUE', statusLightCode: 'REQUISITION' },
    select: { id: true },
  })
  const workerState = await db.statusLightState.findFirstOrThrow({
    where: { code: 'STRONG_GREEN', statusLightCode: 'WORKER' },
    select: { id: true },
  })

  return {
    zoneId: zone.id,
    positionId: position.id,
    modalityId: modality.id,
    departmentId: department.id,
    coverageStateId: coverage.id,
    reqStateId: reqState.id,
    workerStateId: workerState.id,
  }
}

export async function makeHotel(
  reg: Registry,
  params: { label: string; zoneId: string; timeZone: string },
): Promise<string> {
  const id = uuidv7()
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`

  await db.hotel.create({
    data: {
      id,
      name: `Pago ${params.label} ${stamp}`,
      zoneId: params.zoneId,
      timeZone: params.timeZone,
    },
  })
  reg.rows.push({ table: 'commercial.hotel', id })

  return id
}

/**
 * Contrato activo con tarifa de pago por puesto: sin él no hay consolidado.
 * `overtimePayMultiplier` default 1.5 por compatibilidad con las pruebas
 * viejas; 0 = "no paga horas extra" (Hugo, 2026-10-07) ya es un valor válido.
 */
export async function makeContract(
  reg: Registry,
  params: {
    hotelId: string
    positionId: string
    payRate: number
    validFrom: string
    overtimePayMultiplier?: number
  },
): Promise<void> {
  const contractId = uuidv7()
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const otMultiplier = params.overtimePayMultiplier ?? 1.5

  await db.$executeRaw`
    INSERT INTO commercial.contract
      (id, hotel_id, number, status, valid_from, week_start_day, week_end_day,
       overtime_bill_multiplier, overtime_pay_multiplier)
    VALUES (${contractId}::uuid, ${params.hotelId}::uuid, ${`PAGO${stamp}`}, 'ACTIVE',
            ${params.validFrom}::date, 1, 0, ${Math.max(otMultiplier, 1)}::numeric,
            ${otMultiplier}::numeric)`
  reg.rows.push({ table: 'commercial.contract', id: contractId })

  const rateId = uuidv7()

  await db.$executeRaw`
    INSERT INTO commercial.contract_rate (id, contract_id, catalog_position_id, pay_rate, bill_rate)
    VALUES (${rateId}::uuid, ${contractId}::uuid, ${params.positionId}::uuid,
            ${params.payRate}::numeric, ${params.payRate + 10}::numeric)`
  reg.rows.push({ table: 'commercial.contract_rate', id: rateId })
}

export async function makeRequisition(
  reg: Registry,
  params: {
    hotelId: string
    positionId: string
    modalityId: string
    departmentId: string
    coverageStateId: string
    reqStateId: string
    startDate: string
  },
): Promise<string> {
  const id = uuidv7()
  const stamp = `${Date.now()}${Math.floor(Math.random() * 100000)}`

  await db.requisition.create({
    data: {
      id,
      number: `PAG${stamp}`,
      hotelId: params.hotelId,
      statusLightStateId: params.reqStateId,
      statusLightCode: 'REQUISITION',
    },
  })
  reg.rows.push({ table: 'demand.requisition', id })

  const positionId = uuidv7()

  await db.position.create({
    data: {
      id: positionId,
      requisitionId: id,
      lineNumber: 1,
      catalogPositionId: params.positionId,
      hiringModalityId: params.modalityId,
      hotelDepartmentId: params.departmentId,
      quantity: 1,
      startDate: new Date(params.startDate),
      coverageStateId: params.coverageStateId,
      coverageLightCode: 'POSITION_COVERAGE',
    },
  })
  reg.rows.push({ table: 'demand."position"', id: positionId })

  return id
}

/** Una posición más en una requisición que ya existe: el caso de dos o más puestos. */
export async function makePosition(
  reg: Registry,
  params: {
    requisitionId: string
    catalogPositionId: string
    lineNumber: number
    modalityId: string
    departmentId: string
    coverageStateId: string
    startDate: string
  },
): Promise<string> {
  const id = uuidv7()

  await db.position.create({
    data: {
      id,
      requisitionId: params.requisitionId,
      lineNumber: params.lineNumber,
      catalogPositionId: params.catalogPositionId,
      hiringModalityId: params.modalityId,
      hotelDepartmentId: params.departmentId,
      quantity: 1,
      startDate: new Date(params.startDate),
      coverageStateId: params.coverageStateId,
      coverageLightCode: 'POSITION_COVERAGE',
    },
  })
  reg.rows.push({ table: 'demand."position"', id })

  return id
}

export async function makeSchedule(
  reg: Registry,
  params: { hotelId: string; weekStart: string; weekEnd: string; actorId: string },
): Promise<string> {
  const id = uuidv7()

  await db.schedule.create({
    data: {
      id,
      hotelId: params.hotelId,
      weekStart: new Date(params.weekStart),
      weekEnd: new Date(params.weekEnd),
      createdBy: params.actorId,
    },
  })
  reg.rows.push({ table: 'operations.schedule', id })

  return id
}

/** Una hoja de horas con un día de 8 h brutas y 30 min de comida: 7.5 h netas. */
export async function makeTimesheet(
  reg: Registry,
  params: {
    scheduleId: string
    workerId: string
    requisitionId: string
    weekStart: string
    weekEnd: string
    status: 'OPEN' | 'PENDING_APPROVAL' | 'APPROVED'
    approvedAt?: Date | undefined
    actorId: string
    days?: number
  },
): Promise<string> {
  const id = uuidv7()

  await db.timesheet.create({
    data: {
      id,
      scheduleId: params.scheduleId,
      workerId: params.workerId,
      requisitionId: params.requisitionId,
      weekStart: new Date(params.weekStart),
      weekEnd: new Date(params.weekEnd),
      status: params.status,
      approvedBy: params.status === 'APPROVED' ? params.actorId : null,
      approvedAt: params.approvedAt ?? null,
    },
  })
  reg.rows.push({ table: 'operations.timesheet', id })

  for (let i = 0; i < (params.days ?? 1); i += 1) {
    const day = new Date(params.weekStart)
    day.setUTCDate(day.getUTCDate() + i)

    const dayId = uuidv7()

    await db.timesheetDay.create({
      data: {
        id: dayId,
        timesheetId: id,
        workDate: day,
        grossMinutes: 480,
        lunchDeductionMinutes: 30,
        overtimeMinutes: 0,
      },
    })
    reg.rows.push({ table: 'operations.timesheet_day', id: dayId })
  }

  return id
}

export async function makeWorker(
  reg: Registry,
  params: { zoneId: string; workerStateId: string; actorId: string; label: string },
): Promise<string> {
  const id = uuidv7()

  await db.worker.create({
    data: {
      id,
      fullName: `Pago ${params.label} ${Date.now()}`,
      birthDate: new Date('1990-01-01'),
      gender: 'OTHER',
      phone: '9990000003',
      address: 'calle de prueba',
      zoneId: params.zoneId,
      statusLightStateId: params.workerStateId,
      statusLightCode: 'WORKER',
      createdBy: params.actorId,
    },
  })
  reg.rows.push({ table: 'personal.worker', id })

  return id
}

/** Borra lo creado, al revés, incluidos los consolidados de los colaboradores de la prueba. */
export async function cleanup(reg: Registry, workerIds: string[]): Promise<void> {
  // El ponche (real o manual) abre su Timesheet y su Schedule de la semana
  // solo — el servicio los crea sin que la prueba los pida, así que
  // `reg.rows` nunca los registra. Sin este bloque, el hotel y el worker
  // quedan con filas huérfanas y el DELETE de abajo truena por la FK (Hugo,
  // 2026-10-14, destapado al corregir el bug de zona horaria de
  // `ensureSchedule`: antes, ese bug impedía que estas filas llegaran a
  // crearse, y por eso la fuga nunca se había notado).
  if (workerIds.length > 0) {
    await db.$executeRawUnsafe(
      `DELETE FROM operations.punch_mark WHERE timesheet_day_id IN
         (SELECT d.id FROM operations.timesheet_day d
            JOIN operations.timesheet t ON t.id = d.timesheet_id
           WHERE t.worker_id = ANY($1::uuid[]))`,
      workerIds,
    )
    await db.$executeRawUnsafe(
      `DELETE FROM operations.timesheet_day WHERE timesheet_id IN
         (SELECT id FROM operations.timesheet WHERE worker_id = ANY($1::uuid[]))`,
      workerIds,
    )
    await db.$executeRawUnsafe(
      'DELETE FROM operations.timesheet WHERE worker_id = ANY($1::uuid[])',
      workerIds,
    )
  }

  if (workerIds.length > 0) {
    // Las deducciones (Hugo, 2026-10-09: el descuento de un ajuste/gasto
    // incluido ya genera una fila propia aquí) también apuntan RESTRICT al
    // consolidado — sin esto, borrarlo truena.
    await db.$executeRawUnsafe(
      `DELETE FROM settlement.deduction WHERE consolidation_id IN
         (SELECT id FROM settlement.consolidation WHERE worker_id = ANY($1::uuid[]))`,
      workerIds,
    )
    await db.$executeRawUnsafe(
      `DELETE FROM settlement.consolidation_detail WHERE consolidation_id IN
         (SELECT id FROM settlement.consolidation WHERE worker_id = ANY($1::uuid[]))`,
      workerIds,
    )
    await db.$executeRawUnsafe(
      'DELETE FROM settlement.consolidation WHERE worker_id = ANY($1::uuid[])',
      workerIds,
    )
    // El semáforo del colaborador (día de descanso, turno nocturno, corregir
    // marca…) deja su propia fila de historia, nunca registrada en `reg.rows`
    // porque la escribe el servicio, no la prueba.
    await db.$executeRawUnsafe(
      'DELETE FROM personal.worker_state_history WHERE worker_id = ANY($1::uuid[])',
      workerIds,
    )
  }

  for (const row of [...reg.rows].reverse()) {
    await db.$executeRawUnsafe(`DELETE FROM ${row.table} WHERE id = $1::uuid`, row.id)
  }

  // Al final y no antes: un Schedule registrado en `reg.rows` (vía
  // `makeSchedule`) todavía puede tener timesheets de workers AJENOS
  // colgados (p. ej. `observability-pendientes.spec.ts`, que usa workers
  // reales de la base y por eso no están en `workerIds`) — esos ya se
  // borraron arriba, en el loop normal. Solo entonces es seguro barrer lo
  // que el servicio haya creado solo y ningún registro conozca.
  const hotelIds = reg.rows.filter((row) => row.table === 'commercial.hotel').map((row) => row.id)
  if (hotelIds.length > 0) {
    await db.$executeRawUnsafe(
      'DELETE FROM operations.schedule WHERE hotel_id = ANY($1::uuid[])',
      hotelIds,
    )
  }
}

/**
 * La migración 20261006T1000_consolidation_second_batch (columna `run_kind`)
 * ya está aplicada en dev — verificado con `prisma migrate status`
 * (2026-10-07). Esta bandera llevaba apagada la suite entera sin que nadie la
 * prendiera de vuelta; se deja el interruptor por si una base nueva aún no la
 * tiene, pero hoy debe quedar en `true`.
 */
export const SECOND_BATCH_MIGRATED = true
export const describeIfMigrated = SECOND_BATCH_MIGRATED ? describe : describe.skip
