/*
 * ⚠ Imports entre features, permitidos SOLO aquí: la cartera compone
 * `/hotels`, `/prospects` y `/contracts`, cuyos mocks viven en Onboarding y
 * Documentos T&C. Con mocks apagados este módulo es un no-op.
 */
// eslint-disable-next-line no-restricted-imports
import { registerContractsMocks } from '@/features/contracts/api/contractsMocks'
// eslint-disable-next-line no-restricted-imports
import { registerOnboardingMocks } from '@/features/onboarding/api/onboardingMocks'

/**
 * Clientes Activos ya NO tiene endpoint propio (ver `clientsApi.ts`): aquí
 * solo se registran las rutas ajenas que la composición necesita en modo mock.
 */
export function registerClientsMocks(): void {
  registerOnboardingMocks()
  registerContractsMocks()
}
