import { useLingui } from '@lingui/react'
import { useCallback } from 'react'

import { useAppSelector } from '@/app/hooks'
import { selectSessionUser } from '@/app/sessionSlice'

/**
 * La pantalla NATIVA de Permisos en su perfil de hotel (`apps/mobile`: el
 * plugin `OranjePermissions` con `profile: "hotel"`). Al hotel no le hacen
 * falta ubicación ni cámara para ponchar: solo las notificaciones, para
 * enterarse de requisiciones y de su gente. Si no las da, sigue igual: la
 * pantalla nunca bloquea.
 *
 * Habla con el `window.Capacitor` que inyecta el WebView, igual que el puente
 * del Colaborador (`features/worker/lib/nativePermissions.ts`): sin importar
 * `@capacitor/core`. Fuera de la app, o en una app vieja sin el perfil, no
 * hace nada.
 */

const PLUGIN = 'OranjePermissions'

interface CapacitorBridge {
  isNativePlatform?: () => boolean
  isPluginAvailable?: (name: string) => boolean
  nativePromise: <T>(plugin: string, method: string, options?: object) => Promise<T>
}

function bridge(): CapacitorBridge | null {
  const cap = (window as { Capacitor?: CapacitorBridge }).Capacitor
  if (!cap?.isNativePlatform?.() || !cap.isPluginAvailable?.(PLUGIN)) return null
  return cap
}

export function hasHotelPermissionsScreen(): boolean {
  return bridge() !== null
}

/** Abre la pantalla; resuelve al cerrarla (con «Continuar» o con Atrás). */
export async function openHotelPermissions(options: {
  firstName: string
  locale: string
}): Promise<void> {
  const cap = bridge()
  if (!cap) return
  await cap.nativePromise(PLUGIN, 'open', { ...options, profile: 'hotel' })
}

/** La abre con el nombre y el idioma de la persona (D-36), no los del teléfono. */
export function useHotelPermissionsScreen(): () => Promise<void> {
  const user = useAppSelector(selectSessionUser)
  const { i18n } = useLingui()

  return useCallback(
    () =>
      openHotelPermissions({
        firstName: user?.name.trim().split(/\s+/)[0] ?? '',
        locale: i18n.locale,
      }),
    [user, i18n],
  )
}
