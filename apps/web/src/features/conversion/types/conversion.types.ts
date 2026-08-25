import type { OnboardingStatus } from '@/shared/constants/onboardingStatus'

/**
 * Formas de respuesta de la conversión a cliente activo.
 *
 * ⚠ Igual que las demás, su lugar es `packages/contracts` (§5), hoy fuera del
 * alcance acordado.
 */

/** Acción que resuelve un requisito pendiente desde esta misma pantalla. */
export type RequirementActionKind = 'CREATE_HOTEL_USER'

export interface ConversionRequirement {
  id: string
  label: string
  /** Qué falta o con qué se cumplió: la evidencia, no solo el sí o el no. */
  detail: string
  isMet: boolean
  /**
   * `null` cuando el requisito no se resuelve desde aquí. Que un requisito
   * traiga acción lo decide el backend, no la UI.
   */
  action: { kind: RequirementActionKind; label: string } | null
}

export interface ConversionReadiness {
  prospectId: string
  /** Para las acciones que pegan al hotel (crear su usuario). */
  hotelId: string
  hotelName: string
  currentStatus: OnboardingStatus
  targetStatus: OnboardingStatus
  /** Por qué solo cierto rol aprueba, con sus identificadores de requerimiento. */
  approvalNote: string
  requirements: ConversionRequirement[]
  /**
   * Qué ocurre al aprobar. Lo redacta el BACKEND porque describe lo que él
   * mismo hace —columnas que toca, vistas que habilita—; el front no lo sabe
   * ni debe adivinarlo.
   */
  effects: string[]
  /** El backend decide: el front nunca deduce permisos ni requisitos. */
  canApprove: boolean
  /** Motivo por el que no se puede aprobar; `null` cuando sí se puede. */
  blockedReason: string | null
  /** Datos del contacto principal para crear el Usuario del Hotel; `null` sin correo. */
  hotelUserDraft: { email: string; fullName: string } | null
}

/** Fila de la cola: prospectos esperando conversión. */
export interface ConversionCandidate {
  prospectId: string
  hotelName: string
  zone: string
  status: OnboardingStatus
  daysInStatus: number
  /** Cuántos requisitos faltan. `0` = listo para aprobar. */
  pendingRequirements: number
}
