/*
 * ⚠ Imports entre features, permitidos SOLO aquí: la composición de Conversión
 * consume `/prospects` y `/prospects/:id/proposals`, cuyos mocks viven en
 * Onboarding. Es cableado de fixtures — con mocks apagados esto es un no-op.
 */
// eslint-disable-next-line no-restricted-imports
import { registerOnboardingMocks } from '@/features/onboarding/api/onboardingMocks'
// eslint-disable-next-line no-restricted-imports
import { registerProposalsMocks } from '@/features/onboarding/api/proposalsMocks'
import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'

/**
 * La conversión ya NO tiene endpoints propios (ver `conversionApi.ts`). El
 * único mock de esta feature es el del Usuario del Hotel, que ninguna otra
 * registra. Estado en memoria: los hoteles arrancan SIN usuario — que es
 * justo lo que bloquea la conversión en la maqueta.
 */

interface StoredHotelUser {
  id: string
  email: string
  fullName: string
  role: { code: string; name: string }
}

const usersByHotel = new Map<string, StoredHotelUser[]>()
let userSequence = 0

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/hotels/:hotelId/users',
    resolve: ({ params }) => ({ data: usersByHotel.get(params.hotelId ?? '') ?? [] }),
  },
  {
    method: 'POST',
    path: '/hotels/:hotelId/users',
    resolve: ({ params, body }) => {
      const payload = (body ?? {}) as { email?: string; fullName?: string; roleCode?: string }
      if (!payload.email || !payload.fullName) throw new Error('Faltan datos del usuario')
      userSequence += 1
      const user: StoredHotelUser = {
        id: `husr-${String(userSequence).padStart(3, '0')}`,
        email: payload.email,
        fullName: payload.fullName,
        role: { code: payload.roleCode ?? 'ROL-H-03', name: 'Manager General' },
      }
      const hotelId = params.hotelId ?? ''
      usersByHotel.set(hotelId, [...(usersByHotel.get(hotelId) ?? []), user])
      return { data: user }
    },
  },
]

let areRoutesRegistered = false

export function registerConversionMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
  // Las rutas que la composición consume y no son de esta feature.
  registerOnboardingMocks()
  registerProposalsMocks()
}
