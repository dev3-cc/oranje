import { configureStore } from '@reduxjs/toolkit'

import { baseApi } from './baseApi'

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
    // Los slices de UI se registran aquí conforme aparezcan
  },
  middleware: (getDefault) => getDefault().concat(baseApi.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
