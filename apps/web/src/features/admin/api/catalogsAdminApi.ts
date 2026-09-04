import { baseApi } from '@/app/baseApi'
/*
 * ⚠ Import entre features, permitido SOLO aquí: los fixtures de catálogos (y
 * sus writes) viven con Requisiciones, y esta pantalla puede cargar primero.
 * Con mocks apagados esto es un no-op.
 */
// eslint-disable-next-line no-restricted-imports
import { registerRequisitionsMocks } from '@/features/requisitions/api/requisitionsMocks'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

registerRequisitionsMocks()

/** Los catálogos que el Administrador gestiona. Zonas y semáforos NO: las
    zonas amarran territorio e inspectores (RR-13) y los semáforos son
    máquinas de estado del seed. */
export const MANAGED_CATALOGS = [
  'hotel-departments',
  'positions',
  'hiring-modalities',
  'english-levels',
] as const

export type ManagedCatalog = (typeof MANAGED_CATALOGS)[number]

export interface AdminCatalogItem {
  id: string
  code: string
  name: string
  /** Solo posiciones: cada puesto pertenece a UN departamento. */
  hotelDepartmentId?: string
}

export interface AdminCatalogs {
  departments: AdminCatalogItem[]
  positions: AdminCatalogItem[]
  modalities: AdminCatalogItem[]
  englishLevels: AdminCatalogItem[]
}

type FetchWithBQ = (
  arg: string | { url: string; method?: string; body?: unknown },
) => Promise<{ data?: unknown; error?: unknown }>

export const catalogsAdminApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Los cuatro catálogos de una vez: la pantalla es una sola (D-28). */
    getAdminCatalogs: build.query<AdminCatalogs, void>({
      queryFn: async (_arg, _api, _extra, rawBaseQuery) => {
        const fetchWithBQ = rawBaseQuery as FetchWithBQ
        const [departments, positions, modalities, english] = await Promise.all([
          fetchWithBQ('/catalogs/hotel-departments'),
          fetchWithBQ('/catalogs/positions'),
          fetchWithBQ('/catalogs/hiring-modalities'),
          fetchWithBQ('/catalogs/english-levels'),
        ])
        for (const res of [departments, positions, modalities, english]) {
          if (res.error) return { error: res.error as never }
        }
        const items = (res: { data?: unknown }): AdminCatalogItem[] =>
          (res.data as ApiEnvelope<AdminCatalogItem[]>).data
        return {
          data: {
            departments: items(departments),
            positions: items(positions),
            modalities: items(modalities),
            englishLevels: items(english),
          },
        }
      },
      providesTags: [{ type: 'Catalog' as const, id: 'ADMIN' }],
    }),

    createCatalogItem: build.mutation<
      ApiEnvelope<AdminCatalogItem>,
      { catalog: ManagedCatalog; name: string; hotelDepartmentId?: string }
    >({
      query: ({ catalog, ...body }) => ({ url: `/catalogs/${catalog}`, method: 'POST', body }),
      /* El tipo entero: también las llaves con id (formulario de requisición,
         posiciones por departamento) deben refrescarse. */
      invalidatesTags: ['Catalog'],
    }),

    updateCatalogItem: build.mutation<
      ApiEnvelope<AdminCatalogItem>,
      { catalog: ManagedCatalog; id: string; name?: string; hotelDepartmentId?: string }
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
