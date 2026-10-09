import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { hasNativePermissions, usePermissionsScreen } from '@/features/worker'

const SELF = '/collaborator/permissions'

/**
 * `/collaborator/permissions` en la app: abre la pantalla NATIVA de Permisos.
 *
 * El menú del Colaborador («Permisos») y los avisos de Ponchar llevan a esta
 * ruta, que en el web es su página de permisos del navegador. La app no la
 * tenía y mandaba a `/` (el Inicio): la opción «no viajaba». Aquí la misma
 * ruta abre la pantalla nativa — el web no cambia.
 *
 * Al cerrarla, `usePermissionsScreen` lleva a Ponchar o al Inicio según el
 * botón; con Atrás (o sin la pantalla nativa) se regresa a donde estaba.
 */
export function NativePermissionsRoute(): ReactNode {
  const navigate = useNavigate()
  const openPermissions = usePermissionsScreen()
  const opened = useRef(false)
  /* Dónde está ahora la app: al cerrar la pantalla, el botón pudo ya haber navegado. */
  const { pathname } = useLocation()
  const currentPath = useRef(pathname)
  currentPath.current = pathname

  useEffect(() => {
    if (opened.current) return
    opened.current = true

    const goBack = (): void => {
      if (currentPath.current !== SELF) return
      const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0
      if (historyIndex > 0) void navigate(-1)
      else void navigate('/collaborator', { replace: true })
    }

    if (!hasNativePermissions()) {
      goBack()
      return
    }
    void openPermissions().then(goBack)
  }, [navigate, openPermissions])

  return null
}
