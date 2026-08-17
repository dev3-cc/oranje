import type { ContractDetail, ContractList, ContractRow } from '../types/contract.types'

import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'

/**
 * Fixtures de Documentos T&C. ANDAMIO TEMPORAL — se borra cuando `apps/api`
 * exponga `GET /contracts` y `GET /contracts/:id`.
 *
 * `elapsed` y `daysRemaining` están escritos a mano y son coherentes entre sí,
 * como los mandaría el backend: la barra y el pie tienen que contar lo mismo.
 */
const ITEMS: ContractRow[] = [
  {
    id: 'ct-0184',
    number: 'CT-2026-0184',
    hotelName: 'Hotel Puerto Real',
    zoneName: 'Norte',
    status: 'ACTIVE',
    validFrom: '2026-07-01',
    validTo: '2027-06-30',
    elapsed: 0.16,
    daysRemaining: 305,
    positionCount: 4,
    overtimeBillMultiplier: 2,
    holidayBillMultiplier: 2.5,
  },
  {
    id: 'ct-0151',
    number: 'CT-2026-0151',
    hotelName: 'Grand Costa Nube',
    zoneName: 'Centro',
    status: 'ACTIVE',
    validFrom: '2026-05-15',
    validTo: '2026-11-14',
    elapsed: 0.49,
    daysRemaining: 94,
    positionCount: 3,
    overtimeBillMultiplier: 1.75,
    holidayBillMultiplier: 2.25,
  },
  {
    id: 'ct-0098',
    number: 'CT-2026-0098',
    hotelName: 'Hotel Mirador',
    zoneName: 'Norte',
    status: 'ACTIVE',
    validFrom: '2026-03-01',
    validTo: '2026-09-30',
    elapsed: 0.79,
    daysRemaining: 45,
    positionCount: 2,
    overtimeBillMultiplier: 2,
    holidayBillMultiplier: 2,
  },
  {
    id: 'ct-0042',
    number: 'CT-2026-0042',
    hotelName: 'Villas Coral',
    zoneName: 'Sur',
    status: 'EXPIRED',
    validFrom: '2026-01-14',
    validTo: '2026-07-13',
    elapsed: 1,
    daysRemaining: -30,
    positionCount: 3,
    overtimeBillMultiplier: 1.5,
    holidayBillMultiplier: 2,
  },
  {
    id: 'ct-0203',
    number: 'CT-2026-0203',
    hotelName: 'Hotel Las Palmas',
    zoneName: 'Centro',
    status: 'DRAFT',
    validFrom: null,
    validTo: null,
    elapsed: null,
    daysRemaining: null,
    positionCount: 0,
    overtimeBillMultiplier: null,
    holidayBillMultiplier: null,
  },
]

/** Las zonas se mandan aparte: si salieran de las filas, un filtro activo las escondería. */
const ZONE_NAMES = ['Norte', 'Centro', 'Sur']

const DETAIL_CT_0184: ContractDetail = {
  id: 'ct-0184',
  number: 'CT-2026-0184',
  hotelName: 'Hotel Puerto Real',
  status: 'ACTIVE',
  signedByName: 'Lucía Márquez',
  signedAt: '2026-06-20',
  validFrom: '2026-07-01',
  validTo: '2027-06-30',
  // Lunes a domingo. Domingo es 0, así que la semana termina en un número
  // menor que el que la empieza; no es un error de captura.
  weekStartDay: 1,
  weekEndDay: 0,
  multipliers: {
    overtime: { pay: 1.5, bill: 2 },
    holiday: { pay: 2, bill: 2.5 },
  },
  rates: [
    { id: 'rate-0184-1', positionName: 'Housekeeper', payRate: 170, billRate: 250 },
    { id: 'rate-0184-2', positionName: 'Houseman', payRate: 165, billRate: 240 },
    { id: 'rate-0184-3', positionName: 'Laundry', payRate: 160, billRate: 230 },
    { id: 'rate-0184-4', positionName: 'Chef', payRate: 260, billRate: 380 },
  ],
}

/** Catálogo de posiciones del que se sirven los contratos derivados. */
const CATALOG = [
  { positionName: 'Housekeeper', payRate: 170, billRate: 250 },
  { positionName: 'Houseman', payRate: 165, billRate: 240 },
  { positionName: 'Laundry', payRate: 160, billRate: 230 },
  { positionName: 'Chef', payRate: 260, billRate: 380 },
]

/** Un detalle verosímil para los contratos que no tienen maqueta propia. */
function deriveDetail(row: ContractRow): ContractDetail {
  return {
    id: row.id,
    number: row.number,
    hotelName: row.hotelName,
    status: row.status,
    signedByName: 'Lucía Márquez',
    signedAt: row.validFrom ?? '2026-08-01',
    validFrom: row.validFrom ?? '2026-08-01',
    validTo: row.validTo,
    weekStartDay: 1,
    weekEndDay: 0,
    multipliers: {
      // Un borrador sin multiplicadores todavía se guarda en el mínimo legal,
      // que es 1.00: la columna es NOT NULL y no admite bajar de ahí.
      overtime: { pay: 1.5, bill: row.overtimeBillMultiplier ?? 1.5 },
      holiday: { pay: 2, bill: row.holidayBillMultiplier ?? 2 },
    },
    rates: CATALOG.slice(0, row.positionCount).map((entry, index) => ({
      id: `${row.id}-rate-${String(index + 1)}`,
      ...entry,
    })),
  }
}

const DETAILS: Record<string, ContractDetail> = { [DETAIL_CT_0184.id]: DETAIL_CT_0184 }

function findDetail(contractId: string): ContractDetail {
  const authored = DETAILS[contractId]
  if (authored) return authored

  const row = ITEMS.find((item) => item.id === contractId)
  if (!row) throw new Error(`No existe el contrato ${contractId}`)

  return deriveDetail(row)
}

function matches(row: ContractRow, search: string, status: string, zone: string): boolean {
  if (status !== 'ALL' && row.status !== status) return false
  if (zone !== 'ALL' && row.zoneName !== zone) return false

  if (search === '') return true

  const needle = search.toLocaleLowerCase()
  return (
    row.hotelName.toLocaleLowerCase().includes(needle) ||
    row.number.toLocaleLowerCase().includes(needle)
  )
}

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/contracts',
    resolve: ({ search }): ContractList => ({
      items: ITEMS.filter((row) =>
        matches(
          row,
          search.get('search') ?? '',
          search.get('status') ?? 'ALL',
          search.get('zone') ?? 'ALL',
        ),
      ),
      zoneNames: ZONE_NAMES,
    }),
  },
  {
    method: 'GET',
    path: '/contracts/:contractId',
    resolve: ({ params }): ContractDetail => findDetail(params['contractId'] ?? ''),
  },
]

let areRoutesRegistered = false

export function registerContractsMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
}
