import { close, db } from './db.js'

/**
 * Los objetos que Prisma NO sabe declarar y por eso viven solo en el SQL de las
 * migraciones. Su ausencia del datamodel es justo el problema: `migrate diff`
 * los propone para DROP en cada migración siguiente, y el 2026-08-08 se llevó
 * así el índice espacial de la geocerca sin que nadie lo notara.
 *
 * Este test es lo único que los protege.
 */
const INDEXES = [
  ['catalogs', 'ux_status_light_transition_step'],
  ['commercial', 'ix_hotel_coordinates'],
  ['commercial', 'ux_contract_active'],
  ['commercial', 'ux_hotel_contact_primary'],
  ['commercial', 'ux_prospect_hotel_open'],
  ['coverage', 'ux_blacklist_active'],
  ['coverage', 'ux_slot_active_assignment'],
  ['demand', 'ix_slot_position_free'],
  ['demand', 'ux_position_requisition_line'],
  ['personal', 'ix_worker_pool'],
  ['personal', 'ux_worker_rate_active'],
] as const

const CONSTRAINTS = [
  ['operations', 'schedule_entry', 'no_shift_overlap'],
  ['coverage', 'assignment', 'ck_assignment_status'],
  ['settlement', 'consolidation', 'ck_consolidation_amounts'],
  ['settlement', 'consolidation', 'ck_consolidation_signatures'],
  ['commercial', 'contract_rate', 'ck_contract_rate_margin'],
  ['commercial', 'contract', 'ck_contract_multiplier_margin'],
] as const

const VIEWS = [
  ['personal', 'vw_worker'],
  ['coverage', 'vw_pool'],
  ['operations', 'vw_timesheet_day'],
  ['settlement', 'vw_tax_retention_balance'],
] as const

afterAll(close)

describe('los objetos que Prisma no declara', () => {
  it.each(INDEXES)('el índice %s.%s sigue vivo', async (schema, name) => {
    const rows = await db.$queryRaw<Array<{ total: bigint }>>`
      SELECT count(*) AS total FROM pg_indexes
       WHERE schemaname = ${schema} AND indexname = ${name}`

    expect(Number(rows[0]?.total)).toBe(1)
  })

  it.each(CONSTRAINTS)('la restricción %s.%s.%s sigue viva', async (schema, table, name) => {
    const rows = await db.$queryRaw<Array<{ total: bigint }>>`
      SELECT count(*) AS total
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = ${schema} AND t.relname = ${table} AND c.conname = ${name}`

    expect(Number(rows[0]?.total)).toBe(1)
  })

  it.each(VIEWS)('la vista %s.%s sigue viva', async (schema, name) => {
    const rows = await db.$queryRaw<Array<{ total: bigint }>>`
      SELECT count(*) AS total FROM pg_views
       WHERE schemaname = ${schema} AND viewname = ${name}`

    expect(Number(rows[0]?.total)).toBe(1)
  })
})

describe('los permisos del esquema personal', () => {
  it('app_user puede leer el expediente', async () => {
    const rows = await db.$queryRaw<Array<{ ok: boolean }>>`
      SELECT has_schema_privilege('app_user', 'personal', 'USAGE') AS ok`

    expect(rows[0]?.ok).toBe(true)
  })

  it('los once esquemas de negocio son visibles para app_user', async () => {
    const rows = await db.$queryRaw<Array<{ nspname: string }>>`
      SELECT n.nspname
        FROM pg_namespace n
       WHERE n.nspname IN ('catalogs','commercial','coverage','demand','identity','journal',
                           'notifications','operations','personal','settlement','supervision')
         AND NOT has_schema_privilege('app_user', n.nspname, 'USAGE')`

    expect(rows.map((r) => r.nspname)).toEqual([])
  })
})
