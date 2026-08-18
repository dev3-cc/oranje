import type {
  AllowedTransitions,
  ContactAttempt,
  HotelContact,
  ProspectDetail,
  ProspectSummary,
  RegisteredHotel,
  StatusHistoryEntry,
} from '../types/prospect.types'

import {
  CONTACT_ATTEMPT_OUTCOME_LABEL,
  CONTACT_ATTEMPT_TYPE_LABEL,
  type ContactAttemptOutcome,
  type ContactAttemptType,
} from '@/shared/constants/contactAttempt'
import {
  ONBOARDING_STATUS_DESCRIPTION,
  type OnboardingStatus,
} from '@/shared/constants/onboardingStatus'
import type {
  ContactAttemptApi,
  HistoryEntryApi,
  HotelApi,
  HotelContactApi,
  ProspectApi,
  TransitionOptionApi,
} from '@/shared/types/apiContract.types'

/**
 * Adaptadores contrato → vista. Son la ÚNICA frontera entre las formas crudas
 * de `apps/api` (`apiContract.types.ts`) y los tipos que consumen los
 * componentes: si el contrato cambia, se toca aquí y no en las pantallas.
 */

const DAY_MS = 86_400_000

export function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / DAY_MS))
}

/** `Ana Ruiz` → `A. Ruiz`, como se firma en las tarjetas del tablero. */
export function toShortName(fullName: string): string {
  const [first, ...rest] = fullName.trim().split(/\s+/)
  if (!first || rest.length === 0) return fullName
  return `${first[0]}. ${rest.join(' ')}`
}

export function adaptProspectSummary(prospect: ProspectApi): ProspectSummary {
  return {
    id: prospect.id,
    hotelName: prospect.hotel.name,
    zone: prospect.hotel.zone.name,
    status: prospect.state.code as OnboardingStatus,
    daysInStatus: daysSince(prospect.stateSince),
    /**
     * ⚠ Hueco del contrato: `GET /prospects` no trae el último intento ni la
     * versión de propuesta que la tarjeta del diseño muestra. La tarjeta los
     * pinta vacíos hasta que la API los agregue.
     */
    lastAttempt: null,
    latestProposalVersion: null,
    owner: {
      id: prospect.owner.id,
      name: prospect.owner.fullName,
      shortName: toShortName(prospect.owner.fullName),
    },
  }
}

export function adaptContact(contact: HotelContactApi): HotelContact {
  return {
    id: contact.id,
    name: contact.fullName,
    role: contact.jobTitle ?? '',
    phone: contact.phone ?? '',
    email: contact.email ?? '',
    isPrimary: contact.isPrimary,
  }
}

export function adaptAttempt(attempt: ContactAttemptApi): ContactAttempt {
  return {
    id: attempt.id,
    occurredAt: attempt.occurredAt,
    channel:
      CONTACT_ATTEMPT_TYPE_LABEL[attempt.attemptType as ContactAttemptType] ?? attempt.attemptType,
    outcome:
      CONTACT_ATTEMPT_OUTCOME_LABEL[attempt.outcome as ContactAttemptOutcome] ?? attempt.outcome,
    byName: attempt.user.fullName,
  }
}

export function adaptHistoryEntry(entry: HistoryEntryApi): StatusHistoryEntry {
  return {
    id: entry.id,
    fromStatus: (entry.fromState?.code as OnboardingStatus | undefined) ?? null,
    toStatus: entry.toState.code as OnboardingStatus,
    changedAt: entry.occurredAt,
    byName: entry.user.fullName,
    /** ⚠ Hueco del contrato: la historia no trae el rol de quien movió. */
    byRole: '',
    note: entry.reason?.name ?? '',
  }
}

export function adaptTransitions(options: TransitionOptionApi[]): AllowedTransitions {
  return {
    transitions: options.map((option) => ({
      toStatus: option.toState.code as OnboardingStatus,
      title: option.toState.name,
      description: ONBOARDING_STATUS_DESCRIPTION[option.toState.code as OnboardingStatus] ?? '',
      requiresReason: option.requiresReason,
    })),
    /** El backend ya filtra por rol y no explica lo que ocultó. */
    restrictionNote: null,
  }
}

export function adaptRegisteredHotel(hotel: HotelApi): RegisteredHotel {
  return {
    id: hotel.id,
    name: hotel.name,
    zoneId: hotel.zone.id,
    zone: hotel.zone.name,
    timeZone: hotel.timeZone,
    generalPhone: hotel.generalPhone ?? '',
    geofenceMeters: hotel.geofenceRadiusM ?? 0,
    /** ⚠ Hueco del contrato: `commercial.hotel` no expone dirección ni pin. */
    address: '',
    location: null,
  }
}

export function adaptProspectDetail(
  prospect: ProspectApi,
  hotel: HotelApi,
  contacts: HotelContactApi[],
  attempts: ContactAttemptApi[],
  history: HistoryEntryApi[],
): ProspectDetail {
  return {
    id: prospect.id,
    hotelName: prospect.hotel.name,
    status: prospect.state.code as OnboardingStatus,
    cycleStartedAt: prospect.openedAt,
    daysInStatus: daysSince(prospect.stateSince),
    owner: {
      id: prospect.owner.id,
      name: prospect.owner.fullName,
      shortName: toShortName(prospect.owner.fullName),
    },
    hotel: {
      address: '',
      generalPhone: hotel.generalPhone ?? '',
      zoneId: hotel.zone.id,
      zone: hotel.zone.name,
      timeZone: hotel.timeZone,
      geofenceMeters: hotel.geofenceRadiusM ?? 0,
      location: null,
      activatedAsClientAt: hotel.activatedAt,
    },
    needDescription: prospect.needDescription ?? '',
    contacts: contacts.map(adaptContact),
    attempts: attempts.map(adaptAttempt),
    history: history.map(adaptHistoryEntry),
  }
}
