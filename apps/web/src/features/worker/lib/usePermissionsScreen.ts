import { useLingui } from '@lingui/react'
import { useCallback } from 'react'
import { useNavigate } from 'react-router'

import { openNativePermissions } from './nativePermissions'

import { useAppSelector } from '@/app/hooks'
import { selectSessionUser } from '@/app/sessionSlice'

/**
 * Abre la pantalla nativa de Permisos con el nombre y el idioma de la persona
 * (el que eligió en la app, D-36, no el del teléfono) y lleva a donde diga
 * el botón con que se cerró: Ponchar o Inicio. Con Atrás, se queda donde
 * estaba. Fuera de la app no hace nada.
 */
export function usePermissionsScreen(): () => Promise<void> {
  const user = useAppSelector(selectSessionUser)
  const { i18n } = useLingui()
  const navigate = useNavigate()

  return useCallback(async () => {
    const result = await openNativePermissions({
      firstName: user?.name.trim().split(/\s+/)[0] ?? '',
      locale: i18n.locale,
    })
    if (result?.action === 'punch') await navigate('/collaborator/punch')
    else if (result?.action === 'home') await navigate('/collaborator')
  }, [user, i18n, navigate])
}
