import { useEffect, useRef, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'

import { useAppSelector } from './hooks'
import { useRefreshSessionMutation } from './sessionApi'
import { selectSessionStatus } from './sessionSlice'

import logoOranje from '@/assets/logo/Logo_ORANJE_Orange.png'

/**
 * Puerta de las rutas privadas. Vive en `app/` como el router: es cableado
 * global, no una feature.
 *
 * Al montar sin sesión intenta UNA VEZ `POST /auth/refresh` — si la cookie
 * `oranje_refresh` vive, la sesión vuelve sin pedir login (así una recarga no
 * expulsa a nadie). Solo cuando el refresh falla se navega a `/login`.
 */
export function RequireSession(): ReactNode {
  const status = useAppSelector(selectSessionStatus)
  const location = useLocation()
  const [refreshSession] = useRefreshSessionMutation()
  const hasTriedRefresh = useRef(false)

  useEffect(() => {
    if (status !== 'unknown' || hasTriedRefresh.current) return
    hasTriedRefresh.current = true
    void refreshSession()
  }, [status, refreshSession])

  if (status === 'authenticated') return <Outlet />

  if (status === 'anonymous') {
    /** `from` permite volver a donde se iba después del login. */
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  /** `unknown` o `authenticating`: splash mínimo mientras el refresh decide. */
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2">
      <img src={logoOranje} alt="Oranje" className="h-6 w-auto animate-pulse" />
    </div>
  )
}
