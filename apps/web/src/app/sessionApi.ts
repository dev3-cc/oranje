import { baseApi } from './baseApi'

import { registerMockRoutes } from '@/shared/lib/mockBaseQuery'
import type { SessionUser } from '@/shared/types/session.types'

/**
 * Usuario de la sesión. Vive en `app/` y no en una feature porque lo consume el
 * shell —el header y el sidebar—, que se pinta en todas las pantallas: desde
 * una feature arrastraría esa feature entera al bundle inicial.
 *
 * Existe para que el nombre y el rol tengan UNA fuente. Estaban escritos a mano
 * en dos componentes, y ahí es donde empiezan a no coincidir.
 */
registerMockRoutes([
  {
    method: 'GET',
    path: '/me',
    resolve: (): SessionUser => ({
      id: 'usr-ana-ruiz',
      name: 'Ana Ruiz',
      shortName: 'A. Ruiz',
      roleCode: 'BD',
      roleTitle: 'Business Developer',
    }),
  },
])

export const sessionApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSession: build.query<SessionUser, void>({
      query: () => '/me',
    }),
  }),
})

export const { useGetSessionQuery } = sessionApi
