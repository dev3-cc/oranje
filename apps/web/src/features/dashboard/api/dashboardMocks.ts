/*
 * ⚠ Import entre features, permitido SOLO aquí: la composición del Dashboard
 * consume `/prospects` y `/hotels`, cuyos mocks viven en Onboarding. Es
 * cableado de fixtures — con mocks apagados este módulo entero es un no-op.
 */
// eslint-disable-next-line no-restricted-imports
import { registerOnboardingMocks } from '@/features/onboarding/api/onboardingMocks'

/** Efecto secundario: registra el mock de `/me`, que la composición consume. */
import '@/app/sessionApi'

/**
 * El Dashboard ya NO tiene endpoint propio: compone `/me` + `/prospects` +
 * `/hotels` (ver `dashboardApi.ts`). Aquí solo se registran las rutas ajenas
 * que esa composición necesita en modo mock.
 */
export function registerDashboardMocks(): void {
  registerOnboardingMocks()
}
