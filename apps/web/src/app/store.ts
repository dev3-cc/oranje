import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'

import { baseApi } from './baseApi'
import { sessionReducer } from './sessionSlice'

/**
 * Un solo store con dos inquilinos que no se mezclan (D-12):
 *   - caché del servidor -> RTK Query, bajo `api`
 *   - estado de UI       -> slices
 *
 * NO se copia la respuesta del servidor a un slice: un `requisitions: []`
 * dentro de un slice es la respuesta de ayer.
 */
export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    /** Sesión: usuario, rol y accessToken en memoria. El primer slice de UI. */
    session: sessionReducer,
  },
  middleware: (getDefault) => getDefault().concat(baseApi.middleware),
})

/**
 * Sin esto, `refetchOnFocus` y `refetchOnReconnect` de cualquier endpoint
 * quedan inertes: son los listeners los que avisan al store que la pestaña
 * volvió al frente o que la red regresó. No refresca nada por su cuenta —
 * cada endpoint decide si le interesa (hoy, solo el perfil del Colaborador).
 */
setupListeners(store.dispatch)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
