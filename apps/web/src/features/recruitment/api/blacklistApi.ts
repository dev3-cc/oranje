import {
  ANY_VALUE,
  type BlacklistFilters,
  type BlacklistRow,
  type BlacklistSource,
  type CreateBlacklistRequest,
  type LiftBlacklistRequest,
} from '../types/blacklist.types'

import { registerBlacklistMocks } from './blacklistMocks'

import { baseApi } from '@/app/baseApi'
import type { ApiEnvelope, BlacklistEntryApi } from '@/shared/types/apiContract.types'

/**
 * La Blacklist sobre el contrato real de `coverage`: `GET /blacklist` y el
 * levantamiento por colaborador. Las tres reglas las hace cumplir el MOTOR
 * (D-27): el Gris protege, un solo veto vigente con historial completo, y al
 * levantar se vuelve a BLANCO — no a disponible. `blacklist:lift` es solo del
 * Administrador: a los demás roles el backend les responde 403.
 */
registerBlacklistMocks()

function toRow(entry: BlacklistEntryApi): BlacklistRow {
  return {
    id: entry.id,
    workerId: entry.worker.id,
    workerName: entry.worker.fullName,
    source: entry.source as BlacklistSource,
    reason: entry.reason,
    evidencePath: entry.evidencePath,
    enteredByName: entry.enteredBy.fullName,
    occurredAt: entry.occurredAt,
    isActive: entry.isActive,
    liftedAt: entry.liftedAt,
    liftedByName: entry.liftedBy?.fullName ?? null,
    liftReason: entry.liftReason,
  }
}

export const blacklistApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getBlacklist: build.query<BlacklistRow[], BlacklistFilters>({
      query: ({ onlyActive }) => ({
        url: '/blacklist',
        params: { ...(onlyActive ? { onlyActive: true } : {}) },
      }),
      transformResponse: (raw: ApiEnvelope<BlacklistEntryApi[]>, _meta, filters) => {
        const rows = raw.data.map(toRow)
        /** El origen se filtra aquí: la API solo acepta `workerId` y `onlyActive`. */
        return filters.source === ANY_VALUE
          ? rows
          : rows.filter((row) => row.source === filters.source)
      },
      providesTags: [{ type: 'Worker' as const, id: 'BLACKLIST' }],
    }),

    /** El historial de vetos de UNA persona: alimenta `vetoes_previos` del modal. */
    getWorkerBlacklist: build.query<BlacklistRow[], string>({
      query: (workerId) => `/workers/${workerId}/blacklist`,
      transformResponse: (raw: ApiEnvelope<BlacklistEntryApi[]>) => raw.data.map(toRow),
      providesTags: (_r, _e, workerId) => [{ type: 'Worker' as const, id: `BL-${workerId}` }],
    }),

    /**
     * Vetar: nueva fila vigente. El motor hace cumplir las reglas — el GRIS
     * protege y `ux_blacklist_worker` impide un segundo veto activo.
     */
    createBlacklistEntry: build.mutation<unknown, CreateBlacklistRequest>({
      query: ({ workerId, reason, evidencePath }) => ({
        url: `/workers/${workerId}/blacklist`,
        method: 'POST',
        body: { source: 'MANUAL', reason, evidencePath },
      }),
      invalidatesTags: (_r, _e, { workerId }) => [
        { type: 'Worker' as const, id: 'BLACKLIST' },
        { type: 'Worker' as const, id: 'LIST' },
        { type: 'Worker' as const, id: `BL-${workerId}` },
      ],
    }),

    /**
     * Levantar el veto: la fila se marca, no se borra, y el colaborador vuelve
     * a BLANCO — reingresa por la validación de la Reclutadora, como el resto.
     */
    liftBlacklist: build.mutation<unknown, LiftBlacklistRequest>({
      query: ({ workerId, liftReason }) => ({
        url: `/workers/${workerId}/blacklist/lift`,
        method: 'POST',
        body: { liftReason },
      }),
      invalidatesTags: [
        { type: 'Worker' as const, id: 'BLACKLIST' },
        { type: 'Worker' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetBlacklistQuery,
  useGetWorkerBlacklistQuery,
  useCreateBlacklistEntryMutation,
  useLiftBlacklistMutation,
} = blacklistApi
