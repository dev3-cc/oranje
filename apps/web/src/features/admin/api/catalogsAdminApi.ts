import { baseApi } from '@/app/baseApi'
/* Zonas, Motivos y Semáforos (el select de "¿qué semáforo?") ya vivían como
   fixtures del Pipeline — import entre features, permitido SOLO aquí. */
// eslint-disable-next-line no-restricted-imports
import { registerOnboardingMocks } from '@/features/onboarding/api/onboardingMocks'
/*
 * ⚠ Import entre features, permitido SOLO aquí: los fixtures de catálogos (y
 * sus writes) viven con Requisiciones, y esta pantalla puede cargar primero.
 * Con mocks apagados esto es un no-op.
 */
// eslint-disable-next-line no-restricted-imports
import { registerRequisitionsMocks } from '@/features/requisitions/api/requisitionsMocks'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

registerOnboardingMocks()
registerRequisitionsMocks()

/** Los catálogos que el Administrador gestiona. Los semáforos NO: son
    máquinas de estado del seed, no una lista. Zonas sí se administra —
    lo que está en uso lo protege la FK del back (409 CATALOG_IN_USE),
    igual que Departamentos y Posiciones. */
export const MANAGED_CATALOGS = [
  'hotel-departments',
  'positions',
  'hiring-modalities',
  'english-levels',
  'zones',
  'reasons',
] as const

export type ManagedCatalog = (typeof MANAGED_CATALOGS)[number]

export interface AdminCatalogItem {
  id: string
  code: string
  name: string
  /** Solo posiciones: cada puesto pertenece a UN departamento. */
  hotelDepartmentId?: string
  /** Solo motivos: cada uno pertenece a UN semáforo. */
  statusLightCode?: string
}

export interface AdminStatusLight {
  code: string
  name: string
}

export interface AdminCatalogs {
  departments: AdminCatalogItem[]
  positions: AdminCatalogItem[]
  modalities: AdminCatalogItem[]
  englishLevels: AdminCatalogItem[]
  zones: AdminCatalogItem[]
  reasons: AdminCatalogItem[]
  /** Para el select "¿qué semáforo?" al dar de alta un motivo. */
  statusLights: AdminStatusLight[]
}

type FetchWithBQ = (
  arg: string | { url: string; method?: string; body?: unknown },
) => Promise<{ data?: unknown; error?: unknown }>

export const catalogsAdminApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Los siete catálogos de una vez: la pantalla es una sola (D-28). */
    getAdminCatalogs: build.query<AdminCatalogs, void>({
      queryFn: async (_arg, _api, _extra, rawBaseQuery) => {
        const fetchWithBQ = rawBaseQuery as FetchWithBQ
        const [departments, positions, modalities, english, zones, reasons, statusLights] =
          await Promise.all([
            fetchWithBQ('/catalogs/hotel-departments'),
            fetchWithBQ('/catalogs/positions'),
            fetchWithBQ('/catalogs/hiring-modalities'),
            fetchWithBQ('/catalogs/english-levels'),
            fetchWithBQ('/catalogs/zones'),
            fetchWithBQ('/catalogs/reasons'),
            fetchWithBQ('/catalogs/status-lights'),
          ])
        for (const res of [
          departments,
          positions,
          modalities,
          english,
          zones,
          reasons,
          statusLights,
        ]) {
          if (res.error) return { error: res.error as never }
        }
        const items = (res: { data?: unknown }): AdminCatalogItem[] =>
          (res.data as ApiEnvelope<AdminCatalogItem[]>).data
        /* El back manda `statusLight` (el código); el catálogo lo guarda como
           `statusLightCode`, el mismo nombre que usa el alta/edición. */
        const reasonItems: AdminCatalogItem[] = (
          reasons.data as ApiEnvelope<Array<AdminCatalogItem & { statusLight: string }>>
        ).data.map(({ statusLight, ...rest }) => ({ ...rest, statusLightCode: statusLight }))
        const statusLightItems = (
          statusLights.data as ApiEnvelope<Array<{ code: string; name: string }>>
        ).data.map(({ code, name }) => ({ code, name }))
        return {
          data: {
            departments: items(departments),
            positions: items(positions),
            modalities: items(modalities),
            englishLevels: items(english),
            zones: items(zones),
            reasons: reasonItems,
            statusLights: statusLightItems,
          },
        }
      },
      providesTags: [{ type: 'Catalog' as const, id: 'ADMIN' }],
    }),

    createCatalogItem: build.mutation<
      ApiEnvelope<AdminCatalogItem>,
      {
        catalog: ManagedCatalog
        name: string
        hotelDepartmentId?: string
        statusLightCode?: string
      }
    >({
      query: ({ catalog, ...body }) => ({ url: `/catalogs/${catalog}`, method: 'POST', body }),
      /* El tipo entero: también las llaves con id (formulario de requisición,
         posiciones por departamento) deben refrescarse. */
      invalidatesTags: ['Catalog'],
    }),

    updateCatalogItem: build.mutation<
      ApiEnvelope<AdminCatalogItem>,
      {
        catalog: ManagedCatalog
        id: string
        name?: string
        hotelDepartmentId?: string
        statusLightCode?: string
      }
    >({
      query: ({ catalog, id, ...body }) => ({
        url: `/catalogs/${catalog}/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Catalog'],
    }),

    deleteCatalogItem: build.mutation<unknown, { catalog: ManagedCatalog; id: string }>({
      query: ({ catalog, id }) => ({ url: `/catalogs/${catalog}/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Catalog'],
    }),
  }),
})

export const {
  useGetAdminCatalogsQuery,
  useCreateCatalogItemMutation,
  useUpdateCatalogItemMutation,
  useDeleteCatalogItemMutation,
} = catalogsAdminApi
