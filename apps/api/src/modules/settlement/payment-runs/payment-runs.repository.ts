import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

/** REGULAR: el corte del miércoles. EMERGENCY: las horas aprobadas después del corte, el jueves. */
export type RunKind = 'REGULAR' | 'EMERGENCY'

/**
 * 40 horas semanales, por requisición (D-10): lo que exceda es overtime.
 * Hasta hoy `d.overtime_minutes` (siempre 0, nadie lo escribe) hacía que TODO
 * se pagara como regular — este es el corte real, calculado aquí mismo.
 */
export const WEEKLY_OVERTIME_THRESHOLD_MINUTES = 2400

export interface HotelToRun {
  hotelId: string
  hotelName: string
  timeZone: string
}

export interface GenerateResult {
  /** Consolidados nuevos para este hotel y semana. */
  created: number
  /** Consolidados en borrador a los que se les sumaron horas de esta corrida. */
  topped: number
  /** Colaboradores con horas aprobadas que ya no entran: su consolidado no está en borrador. */
  blocked: number
}

/**
 * Las horas aprobadas que todavía no están en ningún consolidado, de una
 * semana y un hotel, hasta el instante de corte. Una sola fuente para el
 * conteo de bloqueados y para la generación.
 *
 * Por qué el filtro de "ya incluida" va por (colaborador, requisición, semana)
 * y no por consolidado: el consolidado es por hotel y semana, así que una
 * jornada aprobada tarde para un colaborador que ya tiene pago esa semana
 * tiene que poder entrar en ese mismo consolidado, si sigue en borrador.
 *
 * La posición sale de la asignación del colaborador dentro de la requisición,
 * no de "todas las posiciones": con dos posiciones, el generador anterior
 * contaba cada hora dos veces.
 */
function pendingHours(params: {
  hotelId: string
  day: string
  runAt: Date
  /** Solo las aprobadas DESPUÉS de este instante (la emergencia del jueves). */
  after: Date | null
}): Prisma.Sql {
  return Prisma.sql`
    FROM operations.timesheet t
    JOIN demand.requisition r ON r.id = t.requisition_id
    JOIN operations.timesheet_day d ON d.timesheet_id = t.id
    JOIN operations.vw_timesheet_day v ON v.id = d.id
    -- Corrección de Contabilidad (Hugo, 2026-10-08): 1:1 por timesheet
    -- (columna UNIQUE), así que este LEFT JOIN no duplica filas.
    LEFT JOIN settlement.timesheet_pay_override ov ON ov.timesheet_id = t.id
    JOIN LATERAL (
      SELECT p.catalog_position_id
        FROM demand."position" p
       WHERE p.requisition_id = t.requisition_id
         AND p.deleted_at IS NULL
       ORDER BY EXISTS (
                  SELECT 1
                    FROM coverage.assignment a
                    JOIN demand.slot s ON s.id = a.slot_id
                   WHERE s.position_id = p.id
                     AND a.worker_id = t.worker_id
                ) DESC,
                p.line_number
       LIMIT 1
    ) pos ON true
   WHERE t.week_start = ${params.day}::date
     AND t.status = 'APPROVED'
     AND t.approved_at <= ${params.runAt}::timestamptz
     ${params.after ? Prisma.sql`AND t.approved_at > ${params.after}::timestamptz` : Prisma.empty}
     AND r.hotel_id = ${params.hotelId}::uuid
     AND NOT EXISTS (
           SELECT 1
             FROM settlement.consolidation_detail cd
             JOIN settlement.consolidation c ON c.id = cd.consolidation_id
            WHERE c.worker_id = t.worker_id
              AND c.week_start = t.week_start
              AND cd.requisition_id = t.requisition_id)`
}

@Injectable()
export class PaymentRunsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Hoteles con horas aprobadas en la semana. Sin ellos no hay nada que correr. */
  async hotelsWithApprovedHours(weekStart: string, hotelId?: string): Promise<HotelToRun[]> {
    return this.prisma.$queryRaw<HotelToRun[]>`
      SELECT DISTINCT h.id AS "hotelId", h.name AS "hotelName", h.time_zone AS "timeZone"
        FROM operations.timesheet t
        JOIN demand.requisition r ON r.id = t.requisition_id
        JOIN commercial.hotel h   ON h.id = r.hotel_id
       WHERE t.week_start = ${weekStart}::date
         AND t.status = 'APPROVED'
         AND (${hotelId ?? null}::uuid IS NULL OR h.id = ${hotelId ?? null}::uuid)
       ORDER BY h.name`
  }

  /**
   * Genera o suma a los consolidados de un hotel y una semana, con las horas
   * aprobadas hasta `runAt`. Idempotente: lo que ya está en un consolidado no
   * vuelve a entrar, así que correrlo dos veces no paga doble.
   *
   * Una sola transacción. Un consolidado que ya no está en borrador (validado,
   * autorizado o pagado) no se toca: sus horas quedan fuera y se cuentan como
   * bloqueadas, para que Contabilidad lo vea en vez de perderlas en silencio.
   */
  async generate(params: {
    hotelId: string
    weekStart: string
    runAt: Date
    userId: string
    slot: string
    runKind: RunKind
    after: Date | null
  }): Promise<GenerateResult> {
    const pending = pendingHours({
      hotelId: params.hotelId,
      day: params.weekStart,
      runAt: params.runAt,
      after: params.after,
    })

    return this.prisma.$transaction(async (tx) => {
      const [blockedRow] = await tx.$queryRaw<Array<{ total: number }>>`
        SELECT count(*)::int AS total
          FROM (
            SELECT DISTINCT t.worker_id, r.hotel_id, t.week_start
              ${pending}
          ) pend
          JOIN settlement.consolidation c
            ON c.worker_id = pend.worker_id
           AND c.hotel_id = pend.hotel_id
           AND c.week_start = pend.week_start
           AND c.run_kind = ${params.runKind}
         WHERE c.status <> 'DRAFT'`

      const rows = await tx.$queryRaw<Array<{ id: string; inserted: boolean }>>`
        WITH horas AS (
          SELECT t.id AS timesheet_id,
                 t.worker_id,
                 t.week_start,
                 t.week_end,
                 t.requisition_id,
                 r.hotel_id,
                 pos.catalog_position_id,
                 -- La corrección de Contabilidad (Hugo, 2026-10-08) pisa el
                 -- reparto antes del corte de 40 h, no después: si ella ya
                 -- partió las horas a mano, el corte no las vuelve a tocar.
                 COALESCE(ov.regular_minutes,
                          LEAST(sum(v.net_minutes), ${WEEKLY_OVERTIME_THRESHOLD_MINUTES}))::int AS regular_minutes,
                 COALESCE(ov.overtime_minutes,
                          GREATEST(sum(v.net_minutes) - ${WEEKLY_OVERTIME_THRESHOLD_MINUTES}, 0))::int AS overtime_minutes,
                 ov.pay_rate AS override_pay_rate
            ${pending}
           GROUP BY t.id, t.worker_id, t.week_start, t.week_end, t.requisition_id,
                    r.hotel_id, pos.catalog_position_id, ov.regular_minutes, ov.overtime_minutes, ov.pay_rate
        ),
        -- El ajuste/gasto de una EVENTUAL (Hugo, 2026-10-09): Contabilidad ya
        -- lo incluyó, pero una corrida anterior pudo haberlo tomado — por
        -- eso applied_at IS NULL en las tres. La asignación se resuelve por
        -- semana, no solo por worker+requisición: una eventual que cambia de
        -- tramo no debe heredar el ajuste de un tramo distinto.
        ajuste_asignacion AS (
          SELECT h.timesheet_id,
                 (SELECT a.id
                    FROM coverage.assignment a
                    JOIN demand.slot s       ON s.id = a.slot_id
                    JOIN demand."position" p ON p.id = s.position_id
                   WHERE a.worker_id = h.worker_id
                     AND p.requisition_id = h.requisition_id
                     AND a.type = 'TEMPORARY'
                     AND a.validity && daterange(h.week_start, h.week_end, '[]')
                   ORDER BY a.validity DESC
                   LIMIT 1) AS assignment_id
            FROM horas h
        ),
        -- Un solo ajuste de tarifa efectivo por hoja: el más reciente incluido.
        ajuste_tarifa AS (
          SELECT DISTINCT ON (aa.timesheet_id)
                 aa.timesheet_id, pa.id AS pay_adjustment_id, pa.amount AS adj_rate
            FROM ajuste_asignacion aa
            JOIN coverage.assignment_pay_adjustment pa
              ON pa.assignment_id = aa.assignment_id
             AND pa.pay_concept_id IS NULL
             AND pa.status = 'APPROVED'
             AND pa.included_at IS NOT NULL
             AND pa.applied_at IS NULL
           ORDER BY aa.timesheet_id, pa.included_at DESC
        ),
        -- El reembolso se suma al bruto de la hoja, como si fueran más horas:
        -- lo pagó el colaborador de su bolsillo.
        ajuste_reembolso AS (
          SELECT aa.timesheet_id,
                 COALESCE(sum(pa.amount), 0) AS adj_reimburse,
                 array_remove(array_agg(pa.id), NULL) AS reimburse_ids
            FROM ajuste_asignacion aa
            LEFT JOIN coverage.assignment_pay_adjustment pa
              ON pa.assignment_id = aa.assignment_id
             AND pa.pay_concept_id IS NOT NULL
             AND pa.settlement_effect = 'REIMBURSE'
             AND pa.status = 'APPROVED'
             AND pa.included_at IS NOT NULL
             AND pa.applied_at IS NULL
           GROUP BY aa.timesheet_id
        ),
        -- El descuento NO toca el bruto: entra como deducción propia (abajo),
        -- sumada aquí mismo para que cabeza la escriba en la MISMA fila que
        -- el bruto — dos CTEs escribiendo la misma tabla en una sentencia no
        -- se ven entre sí (ver la nota en cabeza).
        ajuste_descuento AS (
          SELECT h2.worker_id, h2.hotel_id, h2.week_start,
                 pa.id, pa.amount, pa.reason
            FROM ajuste_asignacion aa
            JOIN horas h2 ON h2.timesheet_id = aa.timesheet_id
            JOIN coverage.assignment_pay_adjustment pa
              ON pa.assignment_id = aa.assignment_id
             AND pa.settlement_effect = 'PAYROLL_DEDUCTION'
             AND pa.status = 'APPROVED'
             AND pa.included_at IS NOT NULL
             AND pa.applied_at IS NULL
        ),
        ajuste_descuento_total AS (
          SELECT worker_id, hotel_id, week_start, sum(amount) AS total
            FROM ajuste_descuento
           GROUP BY worker_id, hotel_id, week_start
        ),
        tarifas AS (
          SELECT h.*,
                 at.pay_adjustment_id AS adj_rate_id,
                 ar.adj_reimburse,
                 ar.reimburse_ids,
                 -- Quien pisa a quién (Hugo, 2026-10-09): la corrección de
                 -- Contabilidad manda sobre el ajuste que pidió Reclutamiento,
                 -- que a su vez manda sobre la tarifa interna o de contrato.
                 COALESCE(h.override_pay_rate, at.adj_rate, wr.rate, cr.pay_rate) AS pay_rate,
                 (h.override_pay_rate IS NULL AND at.adj_rate IS NULL AND wr.rate IS NOT NULL)
                   AS is_internal,
                 -- El del contrato manda (lo copió del hotel al activarse); si
                 -- hay tarifa interna SIN contrato, cae al del hotel directo, y
                 -- sin ninguno de los dos, 0 — nunca se asume 1.5 por default.
                 COALESCE(ct.overtime_pay_multiplier, hot.overtime_pay_multiplier, 0) AS ot_multiplier
            FROM horas h
            LEFT JOIN ajuste_tarifa at ON at.timesheet_id = h.timesheet_id
            LEFT JOIN ajuste_reembolso ar ON ar.timesheet_id = h.timesheet_id
            LEFT JOIN personal.worker_rate wr
                   ON wr.worker_id = h.worker_id
                  AND wr.valid_to IS NULL
                  -- La tarifa de un concepto (p. ej. «Uber») no es la base del pago.
                  AND wr.pay_concept_id IS NULL
                  AND (wr.catalog_position_id = h.catalog_position_id
                       OR wr.catalog_position_id IS NULL)
            LEFT JOIN commercial.contract ct
                   ON ct.hotel_id = h.hotel_id AND ct.status = 'ACTIVE'
            LEFT JOIN commercial.contract_rate cr
                   ON cr.contract_id = ct.id
                  AND cr.catalog_position_id = h.catalog_position_id
            LEFT JOIN commercial.hotel hot
                   ON hot.id = h.hotel_id
        ),
        montos AS (
          SELECT *,
                 round(
                   (regular_minutes  / 60.0) * pay_rate
                 + (overtime_minutes / 60.0) * pay_rate * ot_multiplier
                 + COALESCE(adj_reimburse, 0)
                 , 2) AS subtotal
            FROM tarifas
           WHERE pay_rate IS NOT NULL
        ),
        -- El descuento se escribe AQUÍ, en la misma fila que el bruto: una
        -- segunda sentencia que vuelva a tocar settlement.consolidation en
        -- este mismo WITH no vería esta escritura (ver nota arriba).
        cabeza AS (
          INSERT INTO settlement.consolidation AS c
            (id, worker_id, hotel_id, week_start, week_end, gross_amount, deduction_amount, net_amount, run_kind)
          SELECT gen_random_uuid(), m.worker_id, m.hotel_id, m.week_start, max(m.week_end),
                 sum(m.subtotal), COALESCE(adt.total, 0), sum(m.subtotal) - COALESCE(adt.total, 0),
                 ${params.runKind}::text
            FROM montos m
            LEFT JOIN ajuste_descuento_total adt
                   ON adt.worker_id = m.worker_id
                  AND adt.hotel_id = m.hotel_id
                  AND adt.week_start = m.week_start
           GROUP BY m.worker_id, m.hotel_id, m.week_start, adt.total
          ON CONFLICT (worker_id, hotel_id, week_start, run_kind) DO UPDATE
            SET gross_amount     = c.gross_amount + EXCLUDED.gross_amount,
                deduction_amount = c.deduction_amount + EXCLUDED.deduction_amount,
                net_amount       = (c.gross_amount + EXCLUDED.gross_amount)
                                  - (c.deduction_amount + EXCLUDED.deduction_amount),
                updated_at       = now()
            WHERE c.status = 'DRAFT'
          RETURNING id, worker_id, hotel_id, week_start, (xmax = 0) AS inserted
        ),
        detalles AS (
          INSERT INTO settlement.consolidation_detail
            (id, consolidation_id, requisition_id, hotel_id, catalog_position_id,
             regular_minutes, overtime_minutes, pay_rate_applied,
             overtime_multiplier_applied, is_internal_rate, subtotal)
          SELECT gen_random_uuid(), c.id, m.requisition_id, m.hotel_id, m.catalog_position_id,
                 m.regular_minutes, m.overtime_minutes, m.pay_rate,
                 m.ot_multiplier, m.is_internal, m.subtotal
            FROM montos m
            JOIN cabeza c ON c.worker_id = m.worker_id
                         AND c.hotel_id = m.hotel_id
                         AND c.week_start = m.week_start
          RETURNING consolidation_id
        ),
        -- El descuento SÍ es una deducción propia (Hugo, 2026-10-09): mismo
        -- mecanismo ya probado de addDeduction — una fila trazable, no un
        -- número que se pierde dentro del bruto.
        descuentos AS (
          INSERT INTO settlement.deduction (id, consolidation_id, type, amount, source_note)
          SELECT gen_random_uuid(), c.id, 'PAY_ADJUSTMENT', ad.amount, ad.reason
            FROM ajuste_descuento ad
            JOIN cabeza c ON c.worker_id = ad.worker_id
                         AND c.hotel_id = ad.hotel_id
                         AND c.week_start = ad.week_start
          RETURNING id AS deduction_id, consolidation_id, amount
        ),
        -- Lo que esta corrida ya tomó en cuenta no lo vuelve a tomar una
        -- siguiente — la misma garantía que ya tienen las horas.
        aplicados AS (
          UPDATE coverage.assignment_pay_adjustment pa
             SET applied_at = now()
           WHERE pa.id IN (
                   SELECT pay_adjustment_id FROM ajuste_tarifa
                   UNION
                   SELECT unnest(reimburse_ids) FROM ajuste_reembolso
                   UNION
                   SELECT id FROM ajuste_descuento
                 )
          RETURNING pa.id
        )
        SELECT id, inserted FROM cabeza`

      for (const row of rows) {
        await tx.journalEntry.create({
          data: {
            id: uuidv7(),
            entityType: 'settlement.consolidation',
            entityId: row.id,
            eventType: 'CONSOLIDATION_GENERATED',
            actorUserId: params.userId,
            payload: {
              weekStart: params.weekStart,
              hotelId: params.hotelId,
              slot: params.slot,
              inserted: row.inserted,
            },
          },
        })
      }

      const created = rows.filter((r) => r.inserted).length

      return {
        created,
        topped: rows.length - created,
        blocked: blockedRow?.total ?? 0,
      }
    })
  }
}
