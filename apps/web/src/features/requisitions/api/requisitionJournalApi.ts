import { registerRequisitionsMocks } from './requisitionsMocks'

import { baseApi } from '@/app/baseApi'
import type { ApiEnvelope, RequisitionJournalEntryApi } from '@/shared/types/apiContract.types'

/**
 * `GET /:id/journal` — bitácora de una requisición (`journal.journal`).
 *
 * Archivo aparte de `requisitionsApi.ts` a propósito: esa sesión está a medio
 * editar el resto del módulo (D-34, foto del hotel en el header). D-12 permite
 * inyectar endpoints al mismo `baseApi` desde varios archivos — no hace falta
 * tocar el archivo existente para agregar uno nuevo.
 *
 * Registra sus propios mocks: si algún día este archivo se importa sin pasar
 * por `requisitionsApi.ts` (p. ej. un test que solo monta el diálogo), la ruta
 * sigue viva. `registerRequisitionsMocks` es idempotente.
 */
registerRequisitionsMocks()

export interface RequisitionJournalEntry {
  id: string
  eventType: string
  actorName: string | null
  actorRole: string | null
  payload: unknown
  occurredAt: string
}

function toJournalEntry(raw: RequisitionJournalEntryApi): RequisitionJournalEntry {
  return {
    id: raw.id,
    eventType: raw.eventType,
    actorName: raw.actorName,
    actorRole: raw.actorRole,
    payload: raw.payload,
    occurredAt: raw.occurredAt,
  }
}

export const requisitionJournalApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getRequisitionJournal: build.query<RequisitionJournalEntry[], string>({
      query: (requisitionId) => `/requisitions/${requisitionId}/journal`,
      transformResponse: (raw: ApiEnvelope<RequisitionJournalEntryApi[]>) =>
        raw.data.map(toJournalEntry),
      /**
       * Mismo tag que el resto del módulo: autorizar o eliminar la requisición
       * también deja huella en su bitácora, así que la invalidación existente
       * (`{ type: 'Requisition', id }`) ya la refresca sin tocar nada más.
       */
      providesTags: (_entries, _error, requisitionId) => [
        { type: 'Requisition' as const, id: requisitionId },
      ],
    }),
  }),
})

export const { useGetRequisitionJournalQuery } = requisitionJournalApi
