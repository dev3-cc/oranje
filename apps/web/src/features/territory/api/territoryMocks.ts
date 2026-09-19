/*
 * ⚠ Import entre features, permitido SOLO aquí: la composición de Mi
 * Territorio consume `/hotels` y `/prospects` (mocks de Onboarding) y
 * `/users/:id/zones` (mock de Equipo, con las zonas reales por persona que
 * ya usa el selector de dueño). Es cableado de fixtures — el código de
 * producción no lo usa: con mocks apagados este módulo entero es un no-op.
 */
// eslint-disable-next-line no-restricted-imports
import { registerOnboardingMocks } from '@/features/onboarding/api/onboardingMocks'
// eslint-disable-next-line no-restricted-imports
import { registerTeamMocks } from '@/features/team/api/teamMocks'

/**
 * Mi Territorio ya NO tiene endpoint propio: la pantalla compone `/me`,
 * `GET /users/:id/zones`, `/hotels` y `/prospects` (ver `territoryApi.ts`).
 *
 * `GET /users/:id/zones` NO se registra aquí: antes SÍ vivía en este archivo,
 * como una ruta fija que ignoraba `:id` y devolvía `zones: []` sin importar a
 * quién se pidiera — `teamMocks.ts` ya tenía el `PUT` de la misma URL (asignar
 * zonas a una persona desde Equipo) pero le faltaba el `GET` real. Ahora el
 * `GET` vive ahí, junto al `PUT`, leyendo los mismos `MEMBERS` — así asignar y
 * filtrar nunca se desincronizan entre dos copias de datos.
 */
let areRoutesRegistered = false

export function registerTerritoryMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  // Las rutas que la composición consume y no son de esta feature.
  registerOnboardingMocks()
  registerTeamMocks()
}
