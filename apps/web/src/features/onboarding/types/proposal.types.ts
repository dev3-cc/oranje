import type { OnboardingStatus } from '@/shared/constants/onboardingStatus'

/**
 * Formas de respuesta de los endpoints de Propuestas.
 *
 * ⚠ Igual que las demás, su lugar es `packages/contracts` (§5), hoy fuera del
 * alcance acordado.
 */

/**
 * Una propuesta está en borrador mientras `sent_at` es NULL. No hay un campo
 * `status` en la tabla: el estado ES la fecha de envío, y esta unión solo lo
 * nombra para la UI.
 */
export type ProposalStatus = 'DRAFT' | 'SENT'

export interface ProposalVersionSummary {
  id: string
  version: number
  status: ProposalStatus
  /** `null` mientras es borrador. */
  sentAt: string | null
  /** Quién la envió. La ficha del prospecto lo muestra junto a la fecha. */
  byName: string
  /**
   * Va también en el resumen porque la vista previa del contrato se arma en el
   * front con los datos de la versión, sin pedir nada más.
   */
  servicesNote: string
  payRate: number
  billRate: number
}

/**
 * La versión abierta, la única editable. No lleva `sentAt` porque por
 * definición es la que aún no se envía: en cuanto se envía deja de ser el
 * borrador y `draft` pasa a `null`.
 */
export interface ProposalDraft {
  id: string
  version: number
  /** `services_note` — texto libre. */
  servicesNote: string
  /** Tarifas GLOBALES, no por posición. Ver la nota de la pantalla. */
  payRate: number
  billRate: number
}

export interface ProposalWorkspace {
  prospectId: string
  hotelName: string
  /** Semáforo del prospecto, para el chip del encabezado. */
  prospectStatus: OnboardingStatus
  /**
   * `null` cuando no hay ninguna versión abierta. La creación es explícita
   * (POST) y no un efecto de la lectura: un GET no debe alterar datos.
   */
  draft: ProposalDraft | null
  /** Todas las versiones, de la más nueva a la más vieja. Nunca se borran. */
  versions: ProposalVersionSummary[]
}

/**
 * Fila del módulo Propuestas: la vista transversal de todos los hoteles que
 * tienen alguna. Es de SOLO LECTURA — crear y editar vive dentro del hotel.
 */
export interface ProposalCandidate {
  prospectId: string
  hotelName: string
  zone: string
  prospectStatus: OnboardingStatus
  latestVersion: number
  latestVersionStatus: ProposalStatus
  /** Del borrador abierto es `null`: todavía no se envía. */
  latestSentAt: string | null
}

/** Un prospecto al que se le puede abrir su PRIMERA propuesta (Verde o Café). */
export interface ProposalTarget {
  prospectId: string
  hotelName: string
  zone: string
  prospectStatus: OnboardingStatus
}

export interface SaveProposalDraftRequest {
  proposalId: string
  /** Solo para invalidar la caché del prospecto; no viaja en el cuerpo. */
  prospectId: string
  servicesNote: string
  payRate: number
  billRate: number
}
