import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { SessionUser } from '@/shared/types/session.types'

/**
 * LA sesión: primer slice de UI global del store (Estructura de Proyecto §4:
 * «sesión, rol activo» van en slice, no en RTK Query — el servidor no es la
 * fuente de este estado, la conversación de login lo es).
 *
 * El `accessToken` vive SOLO aquí, en memoria: nada de localStorage, que es
 * legible por cualquier script. La persistencia entre recargas la da la cookie
 * `httpOnly` del refresh — al montar, `RequireSession` intenta
 * `POST /auth/refresh` y si la cookie vive, la sesión vuelve sola.
 */
export type SessionStatus = 'unknown' | 'authenticating' | 'authenticated' | 'anonymous'

export interface SessionState {
  status: SessionStatus
  user: SessionUser | null
  accessToken: string | null
}

const initialState: SessionState = {
  /** `unknown` = todavía no se intenta el refresh. El guard decide qué hacer. */
  status: 'unknown',
  user: null,
  accessToken: null,
}

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    sessionEstablished: (
      state,
      action: PayloadAction<{ user: SessionUser; accessToken: string }>,
    ) => {
      state.status = 'authenticated'
      state.user = action.payload.user
      state.accessToken = action.payload.accessToken
    },
    /** Cierre O refresh fallido: las dos rutas terminan igual, sin sesión. */
    sessionCleared: (state) => {
      state.status = 'anonymous'
      state.user = null
      state.accessToken = null
    },
  },
})

export const { sessionEstablished, sessionCleared } = sessionSlice.actions
export const sessionReducer = sessionSlice.reducer

interface WithSession {
  session: SessionState
}

export const selectSessionStatus = (state: WithSession): SessionStatus => state.session.status
export const selectSessionUser = (state: WithSession): SessionUser | null => state.session.user
export const selectAccessToken = (state: WithSession): string | null => state.session.accessToken
