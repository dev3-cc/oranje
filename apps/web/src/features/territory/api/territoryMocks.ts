/*
 * ⚠ Import entre features, permitido SOLO aquí: la composición de Mi
 * Territorio consume `/hotels` y `/prospects`, cuyos mocks viven en
 * Onboarding. Es cableado de fixtures — el código de producción no lo usa:
 * con mocks apagados este módulo entero es un no-op.
 */
// eslint-disable-next-line no-restricted-imports
import { registerOnboardingMocks } from '@/features/onboarding/api/onboardingMocks'
import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'

/**
 * Mi Territorio ya NO tiene endpoint propio: la pantalla compone `/me`,
 * `/users/:id/zones`, `/hotels` y `/prospects` (ver `territoryApi.ts`). El
 * único mock que queda aquí es el de las zonas asignadas.
 */

const routes: readonly MockRoute[] = [
  /**
   * Zonas asignadas (el módulo de territorio del back). Vacías a propósito:
   * sin asignación, la pantalla compone el territorio con TODOS los hoteles
   * de los mocks de onboarding — igual que la API real con `user_zone` vacío.
   */
  {
    method: 'GET',
    path: '/users/:id/zones',
    resolve: () => ({
      data: {
        user: { id: 'usr-hugo', fullName: 'Hugo', roleCode: 'ROL-V-01' },
        zones: [],
      },
    }),
  },
]

let areRoutesRegistered = false

export function registerTerritoryMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
  // Las rutas que la composición consume y no son de esta feature.
  registerOnboardingMocks()
}
