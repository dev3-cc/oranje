import type {
  AllowedTransitions,
  ChangeStatusRequest,
  UpdateContactAttemptRequest,
  ContactAttempt,
  CreateProspectRequest,
  HotelContactPayload,
  PipelineBoard,
  PipelineFilters,
  ProspectDetail,
  RegisterContactAttemptRequest,
  StatusChangeReason,
  HotelMapPoint,
  RegisteredHotel,
  UpdateProspectRequest,
  Zone,
} from '../types/prospect.types'

import {
  adaptAttempt,
  adaptProspectDetail,
  adaptProspectSummary,
  adaptRegisteredHotel,
  adaptTransitions,
} from './adapters'
import { registerOnboardingMocks } from './onboardingMocks'

import { baseApi } from '@/app/baseApi'
import type { OnboardingStatus } from '@/shared/constants/onboardingStatus'
import type {
  ApiEnvelope,
  CatalogItemApi,
  ContactAttemptApi,
  HistoryEntryApi,
  HotelApi,
  HotelContactApi,
  PaginatedEnvelope,
  ProspectApi,
  ProspectBoardMeta,
  ReasonItemApi,
  TransitionOptionApi,
  TransitionResultApi,
} from '@/shared/types/apiContract.types'

/**
 * Endpoints de Onboarding sobre el `createApi` único (D-12), alineados al
 * contrato REAL de `apps/api`. Las formas crudas viven en
 * `apiContract.types.ts` y aquí se adaptan a los tipos de vista (`adapters.ts`)
 * para que los componentes no carguen con la envoltura `{data, meta}` ni con
 * los huecos del contrato.
 *
 * Los hooks se GENERAN — no se escriben a mano ni se envuelven sin necesidad.
 */
registerOnboardingMocks()

/** `fetchWithBQ` de un `queryFn`: el tipo exacto no está exportado por RTK. */
type FetchWithBQ = (
  args: string | { url: string; method?: string; body?: unknown; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

/**
 * La ficha del prospecto se arma con CINCO recursos: el contrato real no tiene
 * un endpoint compuesto. Se piden en paralelo lo que no depende entre sí.
 */
async function fetchProspectDetail(
  fetchWithBQ: FetchWithBQ,
  prospectId: string,
): Promise<{ data: ProspectDetail } | { error: unknown }> {
  const prospectRes = await fetchWithBQ(`/prospects/${prospectId}`)
  if (prospectRes.error) return { error: prospectRes.error }
  const prospect = (prospectRes.data as ApiEnvelope<ProspectApi>).data

  const [hotelRes, contactsRes, attemptsRes, historyRes] = await Promise.all([
    fetchWithBQ(`/hotels/${prospect.hotel.id}`),
    fetchWithBQ(`/hotels/${prospect.hotel.id}/contacts`),
    fetchWithBQ(`/prospects/${prospectId}/contact-attempts`),
    fetchWithBQ(`/prospects/${prospectId}/history`),
  ])
  const failed = [hotelRes, contactsRes, attemptsRes, historyRes].find((res) => res.error)
  if (failed) return { error: failed.error }

  return {
    data: adaptProspectDetail(
      prospect,
      (hotelRes.data as ApiEnvelope<HotelApi>).data,
      (contactsRes.data as ApiEnvelope<HotelContactApi[]>).data,
      (attemptsRes.data as ApiEnvelope<ContactAttemptApi[]>).data,
      (historyRes.data as ApiEnvelope<HistoryEntryApi[]>).data,
    ),
  }
}

export const onboardingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPipelineBoard: build.query<PipelineBoard, PipelineFilters>({
      query: (filters) => ({
        url: '/prospects',
        params: {
          /** El tablero pinta columnas completas: se pide la página más grande. */
          limit: 100,
          ...(filters.zone ? { zoneId: filters.zone } : {}),
          ...(filters.ownerId ? { ownerUserId: filters.ownerId } : {}),
        },
      }),
      /** `staleDays` se filtra aquí: el contrato real no tiene ese parámetro. */
      transformResponse: (
        raw: PaginatedEnvelope<ProspectApi, ProspectBoardMeta>,
        _meta,
        filters: PipelineFilters,
      ): PipelineBoard => {
        const items = raw.data
          .map(adaptProspectSummary)
          .filter((item) => !filters.staleDays || item.daysInStatus >= filters.staleDays)
        return {
          openCount: raw.meta.total,
          zoneCount: new Set(items.map((item) => item.zone)).size,
          countByStatus: Object.fromEntries(
            raw.meta.byState.map((entry) => [entry.code, entry.total]),
          ),
          items,
        }
      },
      providesTags: (board) => [
        { type: 'Prospect' as const, id: 'LIST' },
        ...(board?.items ?? []).map((item) => ({ type: 'Prospect' as const, id: item.id })),
      ],
    }),

    getProspect: build.query<ProspectDetail, string>({
      queryFn: async (prospectId, _api, _extra, fetchWithBQ) => {
        const result = await fetchProspectDetail(fetchWithBQ as FetchWithBQ, prospectId)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: (_result, _error, prospectId) => [{ type: 'Prospect', id: prospectId }],
    }),

    /** Filtradas por el rol de quien pregunta: el front nunca decide permisos. */
    getAllowedTransitions: build.query<AllowedTransitions, string>({
      query: (prospectId) => `/prospects/${prospectId}/transitions`,
      transformResponse: (raw: ApiEnvelope<TransitionOptionApi[]>) => adaptTransitions(raw.data),
      providesTags: (_result, _error, prospectId) => [{ type: 'Prospect', id: prospectId }],
    }),

    getZones: build.query<Zone[], void>({
      query: () => '/catalogs/zones',
      transformResponse: (raw: ApiEnvelope<CatalogItemApi[]>) =>
        raw.data.map((zone) => ({ id: zone.id, label: zone.name })),
      providesTags: [{ type: 'Catalog', id: 'ZONE' }],
    }),

    /**
     * Alta del prospecto contra el contrato real: TRES recursos en secuencia
     * — `POST /hotels` (si el hotel es nuevo), `POST /hotels/:id/contacts` y
     * `POST /prospects`. El semáforo nace en GRAY y lo fija el backend.
     */
    createProspect: build.mutation<ProspectDetail, CreateProspectRequest>({
      queryFn: async (request, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ

        let hotelId = request.existingHotelId ?? null
        if (request.hotelSource === 'NEW') {
          const hotelRes = await bq({
            url: '/hotels',
            method: 'POST',
            body: {
              name: request.hotel.name,
              zoneId: request.hotel.zoneId,
              timeZone: request.hotel.timeZone,
              ...(request.hotel.generalPhone ? { generalPhone: request.hotel.generalPhone } : {}),
              ...(request.hotel.geofenceMeters
                ? { geofenceRadiusM: request.hotel.geofenceMeters }
                : {}),
              ...(request.hotel.address ? { address: request.hotel.address } : {}),
              ...(request.hotel.placeId ? { placeId: request.hotel.placeId } : {}),
              ...(request.hotel.location
                ? {
                    latitude: request.hotel.location.lat,
                    longitude: request.hotel.location.lng,
                  }
                : {}),
            },
          })
          if (hotelRes.error) return { error: hotelRes.error as never }
          hotelId = (hotelRes.data as ApiEnvelope<HotelApi>).data.id
        }
        if (!hotelId) {
          return { error: { status: 400, data: { message: 'Falta el hotel' } } as never }
        }

        /**
         * Hotel YA registrado: lo que el formulario complete (dirección, pin,
         * teléfono, geocerca) SE GUARDA — los hoteles viejos nacieron sin esos
         * campos y este es el lugar natural para completarlos.
         */
        if (request.hotelSource === 'EXISTING') {
          const patch = {
            ...(request.hotel.generalPhone ? { generalPhone: request.hotel.generalPhone } : {}),
            ...(request.hotel.geofenceMeters
              ? { geofenceRadiusM: request.hotel.geofenceMeters }
              : {}),
            ...(request.hotel.address ? { address: request.hotel.address } : {}),
            ...(request.hotel.placeId ? { placeId: request.hotel.placeId } : {}),
            ...(request.hotel.location
              ? {
                  latitude: request.hotel.location.lat,
                  longitude: request.hotel.location.lng,
                }
              : {}),
          }
          if (Object.keys(patch).length > 0) {
            const patchRes = await bq({ url: `/hotels/${hotelId}`, method: 'PATCH', body: patch })
            if (patchRes.error) return { error: patchRes.error as never }
          }
        }

        if (request.contact.fullName) {
          const contactRes = await bq({
            url: `/hotels/${hotelId}/contacts`,
            method: 'POST',
            body: {
              fullName: request.contact.fullName,
              ...(request.contact.jobTitle ? { jobTitle: request.contact.jobTitle } : {}),
              ...(request.contact.phone ? { phone: request.contact.phone } : {}),
              ...(request.contact.email ? { email: request.contact.email } : {}),
              isPrimary: request.contact.isPrimary,
            },
          })
          if (contactRes.error) return { error: contactRes.error as never }
        }

        const prospectRes = await bq({
          url: '/prospects',
          method: 'POST',
          body: {
            hotelId,
            ownerUserId: request.ownerUserId,
            ...(request.needDescription ? { needDescription: request.needDescription } : {}),
          },
        })
        if (prospectRes.error) return { error: prospectRes.error as never }
        const prospectId = (prospectRes.data as ApiEnvelope<ProspectApi>).data.id

        const detail = await fetchProspectDetail(bq, prospectId)
        return 'error' in detail ? { error: detail.error as never } : { data: detail.data }
      },
      invalidatesTags: [
        { type: 'Prospect', id: 'LIST' },
        { type: 'Hotel', id: 'LIST' },
      ],
    }),

    /**
     * Alta de contactos contra el sub-recurso real (`/hotels/:id/contacts`).
     * Va en secuencia: el backend resuelve el cambio de principal por llamada
     * (marcar uno nuevo desmarca al anterior en su transacción).
     */
    addHotelContacts: build.mutation<
      ProspectDetail,
      { prospectId: string; contacts: HotelContactPayload[] }
    >({
      queryFn: async ({ prospectId, contacts }, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ

        const prospectRes = await bq(`/prospects/${prospectId}`)
        if (prospectRes.error) return { error: prospectRes.error as never }
        const hotelId = (prospectRes.data as ApiEnvelope<ProspectApi>).data.hotel.id

        for (const contact of contacts) {
          const res = await bq({
            url: `/hotels/${hotelId}/contacts`,
            method: 'POST',
            body: {
              fullName: contact.fullName,
              ...(contact.jobTitle ? { jobTitle: contact.jobTitle } : {}),
              ...(contact.phone ? { phone: contact.phone } : {}),
              ...(contact.email ? { email: contact.email } : {}),
              isPrimary: contact.isPrimary,
            },
          })
          if (res.error) return { error: res.error as never }
        }

        const detail = await fetchProspectDetail(bq, prospectId)
        return 'error' in detail ? { error: detail.error as never } : { data: detail.data }
      },
      invalidatesTags: (_result, _error, { prospectId }) => [{ type: 'Prospect', id: prospectId }],
    }),

    /** Hoteles ya registrados, para el modo «Hotel ya registrado» del alta. */
    getRegisteredHotels: build.query<RegisteredHotel[], void>({
      query: () => ({ url: '/hotels', params: { limit: 100 } }),
      transformResponse: (raw: PaginatedEnvelope<HotelApi>) => raw.data.map(adaptRegisteredHotel),
      providesTags: [{ type: 'Hotel', id: 'LIST' }],
    }),

    /**
     * Puntos del globo 3D: solo los hoteles con coordenada. El estado del
     * semáforo no viene en `/hotels`: se compone con los prospectos abiertos.
     */
    getHotelMapPoints: build.query<HotelMapPoint[], void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const [hotelsRes, prospectsRes] = await Promise.all([
          fetchWithBQ({ url: '/hotels', params: { limit: 100 } }),
          fetchWithBQ({ url: '/prospects', params: { limit: 100 } }),
        ])
        if (hotelsRes.error) return { error: hotelsRes.error }
        if (prospectsRes.error) return { error: prospectsRes.error }

        const statusByHotel = new Map(
          (prospectsRes.data as PaginatedEnvelope<ProspectApi>).data.map((prospect) => [
            prospect.hotel.id,
            prospect.state.code as OnboardingStatus,
          ]),
        )

        return {
          data: (hotelsRes.data as PaginatedEnvelope<HotelApi>).data
            .filter((hotel) => hotel.latitude !== null && hotel.longitude !== null)
            .map((hotel) => ({
              id: hotel.id,
              name: hotel.name,
              lat: hotel.latitude as number,
              lng: hotel.longitude as number,
              isClient: hotel.isClient,
              photoUrl: hotel.photoUrl,
              status: statusByHotel.get(hotel.id) ?? null,
            })),
        }
      },
      providesTags: [
        { type: 'Hotel', id: 'LIST' },
        { type: 'Prospect', id: 'LIST' },
      ],
    }),

    /**
     * Edición contra el contrato real: el hotel por `PATCH /hotels/:id` y el
     * dueño + la necesidad por `PATCH /prospects/:id`. El contacto se edita en
     * su propio diálogo, no aquí.
     */
    updateProspect: build.mutation<ProspectDetail, UpdateProspectRequest>({
      queryFn: async (request, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ

        const prospectRes = await bq(`/prospects/${request.prospectId}`)
        if (prospectRes.error) return { error: prospectRes.error as never }
        const hotelId = (prospectRes.data as ApiEnvelope<ProspectApi>).data.hotel.id

        const patchRes = await bq({
          url: `/hotels/${hotelId}`,
          method: 'PATCH',
          body: {
            name: request.hotel.name,
            zoneId: request.hotel.zoneId,
            timeZone: request.hotel.timeZone,
            ...(request.hotel.generalPhone ? { generalPhone: request.hotel.generalPhone } : {}),
            ...(request.hotel.geofenceMeters
              ? { geofenceRadiusM: request.hotel.geofenceMeters }
              : {}),
            ...(request.hotel.address ? { address: request.hotel.address } : {}),
            ...(request.hotel.placeId ? { placeId: request.hotel.placeId } : {}),
            ...(request.hotel.location
              ? {
                  latitude: request.hotel.location.lat,
                  longitude: request.hotel.location.lng,
                }
              : {}),
          },
        })
        if (patchRes.error) return { error: patchRes.error as never }

        const prospectPatch = await bq({
          url: `/prospects/${request.prospectId}`,
          method: 'PATCH',
          body: {
            ownerUserId: request.ownerUserId,
            ...(request.needDescription ? { needDescription: request.needDescription } : {}),
          },
        })
        if (prospectPatch.error) return { error: prospectPatch.error as never }

        const detail = await fetchProspectDetail(bq, request.prospectId)
        return 'error' in detail ? { error: detail.error as never } : { data: detail.data }
      },
      /** También la lista: cambiar zona o nombre altera la tarjeta del tablero. */
      invalidatesTags: (_result, _error, { prospectId }) => [
        { type: 'Prospect', id: prospectId },
        { type: 'Prospect', id: 'LIST' },
      ],
    }),

    /**
     * El catálogo real filtra por SEMÁFORO, no por estado destino: llegan
     * todos los motivos del Onboarding y el `id` de la vista es el CODE, que
     * es lo que `POST .../transitions` espera como `reasonCode`.
     */
    getStatusChangeReasons: build.query<StatusChangeReason[], OnboardingStatus>({
      query: () => ({ url: '/catalogs/reasons', params: { statusLight: 'ONBOARDING' } }),
      transformResponse: (raw: ApiEnvelope<ReasonItemApi[]>) =>
        raw.data.map((reason) => ({ id: reason.code, label: reason.name })),
      providesTags: [{ type: 'Catalog', id: 'STATUS_CHANGE_REASON' }],
    }),

    /** Corrección de un intento: SOLO su autor (lo verifica la API). */
    updateContactAttempt: build.mutation<ContactAttempt, UpdateContactAttemptRequest>({
      query: ({ prospectId, attemptId, ...body }) => ({
        url: `/prospects/${prospectId}/contact-attempts/${attemptId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (raw: ApiEnvelope<ContactAttemptApi>) => adaptAttempt(raw.data),
      invalidatesTags: (_result, _error, { prospectId }) => [
        { type: 'Prospect', id: prospectId },
        { type: 'Prospect', id: 'LIST' },
      ],
    }),

    /** Borrado de un intento: SOLO su autor — el de prueba o el capturado doble. */
    deleteContactAttempt: build.mutation<void, { prospectId: string; attemptId: string }>({
      query: ({ prospectId, attemptId }) => ({
        url: `/prospects/${prospectId}/contact-attempts/${attemptId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { prospectId }) => [
        { type: 'Prospect', id: prospectId },
        { type: 'Prospect', id: 'LIST' },
      ],
    }),

    registerContactAttempt: build.mutation<ContactAttempt, RegisterContactAttemptRequest>({
      query: ({ prospectId, ...body }) => ({
        url: `/prospects/${prospectId}/contact-attempts`,
        method: 'POST',
        body,
      }),
      transformResponse: (raw: ApiEnvelope<ContactAttemptApi>) => adaptAttempt(raw.data),
      /** También la lista: el tablero muestra el último intento en la tarjeta. */
      invalidatesTags: (_result, _error, { prospectId }) => [
        { type: 'Prospect', id: prospectId },
        { type: 'Prospect', id: 'LIST' },
      ],
    }),

    /**
     * `POST /prospects/:id/transitions` responde solo `{from, to}` (200): el
     * prospecto se refresca por la invalidación del tag, no por la respuesta.
     */
    changeProspectStatus: build.mutation<
      { from: OnboardingStatus; to: OnboardingStatus },
      ChangeStatusRequest
    >({
      query: ({ prospectId, toStatus, reasonId }) => ({
        url: `/prospects/${prospectId}/transitions`,
        method: 'POST',
        body: {
          toState: toStatus,
          ...(reasonId ? { reasonCode: reasonId } : {}),
        },
      }),
      transformResponse: (raw: ApiEnvelope<TransitionResultApi>) => ({
        from: raw.data.from as OnboardingStatus,
        to: raw.data.to as OnboardingStatus,
      }),
      invalidatesTags: (_result, _error, { prospectId }) => [
        { type: 'Prospect', id: prospectId },
        { type: 'Prospect', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetPipelineBoardQuery,
  useGetProspectQuery,
  useGetAllowedTransitionsQuery,
  useGetZonesQuery,
  useCreateProspectMutation,
  useAddHotelContactsMutation,
  useGetRegisteredHotelsQuery,
  useGetHotelMapPointsQuery,
  useUpdateProspectMutation,
  useGetStatusChangeReasonsQuery,
  useRegisterContactAttemptMutation,
  useUpdateContactAttemptMutation,
  useDeleteContactAttemptMutation,
  useChangeProspectStatusMutation,
} = onboardingApi
