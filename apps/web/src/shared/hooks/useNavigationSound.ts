import { useEffect, useRef } from 'react'
import { NavigationType, useLocation, useNavigationType } from 'react-router'

import { playSound } from '@/shared/lib/sound'

/**
 * Un toque corto al cambiar de pantalla, con el mismo sentido que ya tiene la
 * animación del shell: avanzar suena una nota y volver otra más grave.
 *
 * La primera pantalla NO suena — entrar a la app no es navegar —, y la
 * preferencia de cada navegador la respeta `playSound`.
 */
export function useNavigationSound(): void {
  const location = useLocation()
  const navigationType = useNavigationType()
  const previous = useRef<string | null>(null)

  useEffect(() => {
    const path = location.pathname
    /* El primer render solo toma nota: la carga inicial no es un movimiento. */
    if (previous.current === null) {
      previous.current = path
      return
    }
    if (previous.current === path) return
    previous.current = path
    playSound(navigationType === NavigationType.Pop ? 'back' : 'navigate')
  }, [location.pathname, navigationType])
}
