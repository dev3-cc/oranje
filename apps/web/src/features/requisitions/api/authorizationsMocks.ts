import { registerRequisitionsMocks } from './requisitionsMocks'

/**
 * La cola de autorización ya NO tiene endpoint propio: es `GET /requisitions`
 * filtrado por `APPLE_GREEN` más `/me` (ver `authorizationsApi.ts`). Todas sus
 * rutas las registra el mock de requisiciones.
 */
export function registerAuthorizationsMocks(): void {
  registerRequisitionsMocks()
}
