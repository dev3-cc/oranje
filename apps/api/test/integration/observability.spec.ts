import type { PrismaService } from '../../src/infra/prisma/index.js'
import { ObservabilityRepository } from '../../src/modules/observability/observability.repository.js'
import { ObservabilityService } from '../../src/modules/observability/observability.service.js'

import { close, db } from './db.js'

/**
 * Observador (`ROL-OBS-01`, Roles del Sistema.md 2026-09-21): rol transversal
 * de solo lectura sin alcance por hotel/departamento, así que estas pruebas
 * no necesitan un `actor` — el propio servicio no filtra nada, la Matriz de
 * Permisos ya lo hace en el guard.
 *
 * Cubre el hallazgo central de esta feature: de los 9 semáforos, solo 3
 * tienen historial real (duración exacta), 2 solo tienen estado actual, 2 son
 * aproximados por un par de timestamps fuera del sistema genérico, y 2 no
 * están implementados en absoluto — reportado así, no inventado.
 */

const prisma = db as unknown as PrismaService
const repo = new ObservabilityRepository(prisma)
const service = new ObservabilityService(repo)

afterAll(close)

describe('Observador', () => {
  it('reporta los 9 semáforos con su nivel real de detalle', async () => {
    const summary = await service.statusLightDurations()
    const byCode = new Map(summary.map((s) => [s.code, s]))

    expect(byCode.size).toBe(9)

    for (const code of ['WORKER', 'REQUISITION', 'ONBOARDING']) {
      const light = byCode.get(code)
      expect(light?.hasHistory).toBe(true)
      expect(light?.states).not.toBeNull()
      // Total de vida completa (Hugo, 2026-09-21: "en total por todas"),
      // aparte del desglose por estado — nunca su suma.
      expect(light?.total).toBeDefined()
      expect(light?.total?.entities).toBeGreaterThanOrEqual(0)
    }

    for (const code of ['POSITION_COVERAGE', 'URGENCY']) {
      const light = byCode.get(code)
      expect(light?.hasHistory).toBe(false)
      expect(light?.states).not.toBeNull()
    }

    for (const code of ['DAY_REVIEW', 'WEEK_APPROVAL']) {
      const light = byCode.get(code)
      expect(light?.states).toBeNull()
      expect(light?.span).toBeDefined()
    }

    for (const code of ['QUALITY', 'TIMESHEET_COMPLIANCE']) {
      const light = byCode.get(code)
      expect(light?.states).toBeNull()
      expect(light?.span).toBeUndefined()
    }
  })

  it('reporta los 7 departamentos, dos marcados como no implementados', async () => {
    const metrics = await service.departmentMetrics()
    const byCode = new Map(metrics.map((m) => [m.code, m]))

    expect(byCode.size).toBe(7)
    expect(byCode.get('QA')?.implemented).toBe(false)
    expect(byCode.get('CUSTOMER_SERVICE')?.implemented).toBe(false)
    expect(byCode.get('RECRUITMENT')?.implemented).toBe(true)
    expect(byCode.get('HOTEL')?.implemented).toBe(true)
    expect(byCode.get('SALES')?.implemented).toBe(true)
  })

  it('pagina el feed de ponches de todos los hoteles', async () => {
    const page = await service.punches({ page: 1, limit: 5 })

    expect(page.page).toBe(1)
    expect(page.limit).toBe(5)
    expect(page.rows.length).toBeLessThanOrEqual(5)
    expect(page.total).toBeGreaterThanOrEqual(page.rows.length)
    expect(page.totalPages).toBeGreaterThanOrEqual(1)

    /**
     * Hugo (2026-09-21): "no puedo ver si las personas están ponchando en
     * tiempo" — cada fila trae el inicio programado del turno ese día
     * (`operations.schedule_entry`, LATERAL a un solo renglón por si hubiera
     * más de un turno) y, solo para CLOCK_IN, los minutos de diferencia SIN
     * tolerancia inventada: el número crudo, nunca un "a tiempo" decidido aquí.
     */
    for (const row of page.rows) {
      if (row.type !== 'CLOCK_IN') {
        expect(row.lateMinutes).toBeNull()
      }
      if (row.scheduledStart === null) {
        expect(row.lateMinutes).toBeNull()
      }
    }
  })

  /**
   * Hugo (2026-09-21): enlazar desde aquí a la lista real de Requisiciones y
   * al Pipeline (Ventas). Reutiliza `requisitions:read_all` y `pipeline:read`
   * + `pipeline:read_all` — seguro porque el Observador tiene `hotelId=null`,
   * igual que Reclutamiento y el BDC, así que esas lecturas no filtran nada.
   */
  it('el Observador tiene lectura otorgada a Requisiciones y Pipeline, sin permisos de escritura', async () => {
    const rows = await prisma.$queryRaw<Array<{ module: string; action: string }>>`
      SELECT rp.module, rp.action
        FROM identity.role_permission rp
        JOIN identity.role r ON r.id = rp.role_id
       WHERE r.code = 'ROL-OBS-01'
       ORDER BY rp.module, rp.action`

    const keys = rows.map((r) => `${r.module}:${r.action}`)

    expect(keys).toEqual(
      expect.arrayContaining([
        'observability:read_status_durations',
        'observability:read_punches',
        'observability:read_department_metrics',
        'requisitions:read_all',
        'pipeline:read',
        'pipeline:read_all',
      ]),
    )
    expect(
      keys.some((k) => k.includes('create') || k.includes('update') || k.includes('delete')),
    ).toBe(false)
  })
})
