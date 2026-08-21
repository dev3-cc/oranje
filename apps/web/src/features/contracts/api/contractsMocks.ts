/*
 * ⚠ Import entre features, permitido SOLO aquí: la lista resuelve la zona con
 * `/hotels`, cuyo mock vive en Onboarding. Con mocks apagados esto es no-op.
 */
// eslint-disable-next-line no-restricted-imports
import { registerOnboardingMocks } from '@/features/onboarding/api/onboardingMocks'
import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope, ContractApi, ContractRateApi } from '@/shared/types/apiContract.types'

/**
 * Fixtures de `commercial.contract` en la forma CRUDA del contrato real
 * (`ContractEntity` del backend): la lista sin tarifas, el detalle con ellas.
 * Los hoteles son los cinco clientes convertidos de los fixtures de
 * Onboarding (`htl-psp-0012` … `htl-psp-0016`).
 */

/** Fechas relativas a hoy: los «vence en N días» del spec no caducan. */
function isoInDays(days: number): string {
  const date = new Date(Date.now() + days * 86_400_000)
  return date.toISOString().slice(0, 10)
}

const CATALOG: Array<Omit<ContractRateApi, 'id'>> = [
  {
    payRate: '170.00',
    billRate: '250.00',
    position: { id: 'pos-hk', code: 'HK', name: 'Housekeeper' },
  },
  {
    payRate: '165.00',
    billRate: '240.00',
    position: { id: 'pos-hm', code: 'HM', name: 'Houseman' },
  },
  {
    payRate: '160.00',
    billRate: '230.00',
    position: { id: 'pos-ln', code: 'LN', name: 'Laundry' },
  },
  { payRate: '260.00', billRate: '380.00', position: { id: 'pos-ch', code: 'CH', name: 'Chef' } },
]

function rates(contractId: string, count: number): ContractRateApi[] {
  return CATALOG.slice(0, count).map((entry, index) => ({
    ...entry,
    id: `rate-${contractId}-${String(index + 1)}`,
  }))
}

interface StoredContract extends ContractApi {
  rates: ContractRateApi[]
}

function buildContract(input: {
  id: string
  number: string
  hotelId: string
  hotelName: string
  status: string
  validFrom: string
  validTo: string | null
  signedAt: string | null
  positionCount: number
  overtimeBill?: string
  holidayBill?: string
}): StoredContract {
  return {
    id: input.id,
    number: input.number,
    hotel: { id: input.hotelId, name: input.hotelName },
    status: input.status,
    validFrom: input.validFrom,
    validTo: input.validTo,
    week: { startDay: 1, endDay: 0 },
    multipliers: {
      overtimeBill: input.overtimeBill ?? '2.00',
      overtimePay: '1.50',
      holidayBill: input.holidayBill ?? '2.50',
      holidayPay: '2.00',
    },
    deductsMeals: false,
    splitsInvoiceByMonth: false,
    signedAt: input.signedAt,
    createdAt: input.validFrom,
    rates: rates(input.id, input.positionCount),
  }
}

const CONTRACTS: StoredContract[] = [
  buildContract({
    id: 'ct-0184',
    number: 'CT-2026-0184',
    hotelId: 'htl-psp-0012',
    hotelName: 'Hotel Puerto Real',
    status: 'ACTIVE',
    validFrom: isoInDays(-55),
    validTo: isoInDays(310),
    signedAt: '2026-06-20',
    positionCount: 4,
  }),
  buildContract({
    id: 'ct-0151',
    number: 'CT-2026-0151',
    hotelId: 'htl-psp-0013',
    hotelName: 'Grand Costa Nube',
    status: 'ACTIVE',
    validFrom: isoInDays(-100),
    validTo: isoInDays(94),
    signedAt: '2026-05-10',
    positionCount: 3,
  }),
  buildContract({
    id: 'ct-0098',
    number: 'CT-2026-0098',
    hotelId: 'htl-psp-0014',
    hotelName: 'Hotel Mirador',
    status: 'ACTIVE',
    validFrom: isoInDays(-170),
    validTo: isoInDays(45),
    signedAt: '2026-02-25',
    positionCount: 2,
  }),
  buildContract({
    id: 'ct-0042',
    number: 'CT-2026-0042',
    hotelId: 'htl-psp-0015',
    hotelName: 'Villas Coral',
    status: 'EXPIRED',
    validFrom: isoInDays(-220),
    validTo: isoInDays(-38),
    signedAt: '2026-01-10',
    positionCount: 3,
  }),
  buildContract({
    id: 'ct-0203',
    number: 'CT-2026-0203',
    hotelId: 'htl-psp-0016',
    hotelName: 'Hotel Las Palmas',
    status: 'DRAFT',
    validFrom: isoInDays(11),
    validTo: null,
    signedAt: null,
    positionCount: 0,
  }),
]

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/contracts',
    resolve: ({ search }): ApiEnvelope<ContractApi[]> => {
      const hotelId = search.get('hotelId')
      const status = search.get('status')
      const items = CONTRACTS.filter((contract) => {
        if (hotelId && contract.hotel.id !== hotelId) return false
        if (status && contract.status !== status) return false
        return true
      })
      // La lista NO trae tarifas, como el backend.
      return { data: items.map(({ rates: _rates, ...contract }) => contract) }
    },
  },
  {
    method: 'GET',
    path: '/contracts/:contractId',
    resolve: ({ params }): ApiEnvelope<ContractApi> => {
      const contract = CONTRACTS.find((item) => item.id === params.contractId)
      if (!contract) throw new Error('CONTRACT_NOT_FOUND')
      return { data: contract }
    },
  },
]

let areRoutesRegistered = false

export function registerContractsMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
  // La zona de cada fila sale de `/hotels`, que registra Onboarding.
  registerOnboardingMocks()
}
