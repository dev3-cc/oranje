import { useLingui } from '@lingui/react/macro'
import { useEffect, useRef, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'

import { useAppSelector } from './hooks'
import { useRefreshSessionMutation } from './sessionApi'
import { selectSessionStatus } from './sessionSlice'

import { LoadingOranje } from '@/shared/components/LoadingOranje'

/**
 * Puerta de las rutas privadas. Vive en `app/` como el router: es cableado
 * global, no una feature.
 *
 * Al montar sin sesión intenta UNA VEZ `POST /auth/refresh` — si la cookie
 * `oranje_refresh` vive, la sesión vuelve sin pedir login (así una recarga no
 * expulsa a nadie). Solo cuando el refresh falla se navega a `/login`.
 */
export function RequireSession(): ReactNode {
  const { t } = useLingui()
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
    /* Quien venía a `/colaborador` vuelve por su propia puerta, con sus textos. */
    const login = location.pathname.startsWith('/colaborador') ? '/colaborador/login' : '/login'
    /* Con la búsqueda: la liga del QR del acceso trae el código en `?qr=` y
       tiene que sobrevivir al login. */
    return <Navigate to={login} replace state={{ from: location.pathname + location.search }} />
  }

  /** `unknown` o `authenticating`: la naranja girando mientras el refresh decide. */
  return <LoadingOranje label={t`Abriendo tu sesión…`} />
}
