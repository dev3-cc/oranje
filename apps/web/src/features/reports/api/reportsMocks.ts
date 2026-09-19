/*
 * ⚠ Imports entre features, permitidos SOLO aquí: la composición usa
 * `/prospects` (+historial e intentos) de Onboarding y `/team` de Mi Equipo.
 * Con mocks apagados este módulo es un no-op.
 */
// eslint-disable-next-line no-restricted-imports
import { registerOnboardingMocks } from '@/features/onboarding/api/onboardingMocks'
// eslint-disable-next-line no-restricted-imports
import { registerTeamMocks } from '@/features/team/api/teamMocks'

/**
 * Reportes · Ventas no tiene rutas propias: todo lo que consume ya está
 * registrado por Onboarding y Mi Equipo.
 */
export function registerReportsMocks(): void {
  registerOnboardingMocks()
  registerTeamMocks()
}
