import { useLingui } from '@lingui/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { useAppSelector } from '@/app/hooks'
import { selectSessionUser } from '@/app/sessionSlice'
import { hasNativePermissions, openNativePermissions } from '@/features/worker'

/**
 * `/collaborator/permissions` en la app: abre la pantalla NATIVA de Permisos.
 *
 * El menú del Colaborador («Permisos») y los avisos de Ponchar llevan a esta
 * ruta, que en el web es su página de permisos del navegador. La app no la
 * tenía y mandaba a `/` (el Inicio): la opción «no viajaba». Aquí la misma
 * ruta abre la pantalla nativa — el web no cambia.
 *
 * Al cerrarla decide UNA sola navegación: Ponchar o Inicio REEMPLAZAN esta
 * entrada del historial (si no, Atrás volvía aquí y la pantalla se reabría);
 * con Atrás, se regresa a donde estaba. No se usa `usePermissionsScreen`:
 * aquel navega por su cuenta y, sumado al regreso de aquí, se pisaban — la
 * app volvía a esta ruta y la pantalla se abría en ciclo.
 */
export function NativePermissionsRoute(): ReactNode {
  const navigate = useNavigate()
  const user = useAppSelector(selectSessionUser)
  const { i18n } = useLingui()
  const opened = useRef(false)

  useEffect(() => {
    if (opened.current) return
    opened.current = true

    const goBack = (): void => {
      const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0
      if (historyIndex > 0) void navigate(-1)
      else void navigate('/collaborator', { replace: true })
    }

    if (!hasNativePermissions()) {
      goBack()
      return
    }
    void openNativePermissions({
      firstName: user?.name.trim().split(/\s+/)[0] ?? '',
      locale: i18n.locale,
    }).then((result) => {
      if (result?.action === 'punch') void navigate('/collaborator/punch', { replace: true })
      else if (result?.action === 'home') void navigate('/collaborator', { replace: true })
      else goBack()
    })
  }, [navigate, user, i18n])

  return null
}
