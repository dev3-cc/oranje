import { useState } from 'react'

/**
 * Un onboarding de PÁGINA se ve una sola vez — bloquear el contenido en cada
 * visita convierte la ayuda en estorbo. El visto se recuerda por pantalla en
 * `localStorage` (conveniencia por navegador, no estado de negocio) y
 * `reopen` lo vuelve a mostrar a demanda («¿Cómo funciona?»).
 *
 * Si `localStorage` no está disponible, el intro se da por visto: mejor
 * perder la bienvenida que bloquear la pantalla en cada carga.
 */
export function useIntroSeen(screenKey: string): {
  isIntroOpen: boolean
  dismissIntro: () => void
  reopenIntro: () => void
} {
  const storageKey = `oranje-intro-${screenKey}`

  const [isIntroOpen, setIntroOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) !== 'true'
    } catch {
      return false
    }
  })

  return {
    isIntroOpen,
    dismissIntro: () => {
      setIntroOpen(false)
      try {
        localStorage.setItem(storageKey, 'true')
      } catch {
        /* Sin storage el visto no persiste; la sesión actual sí lo respeta. */
      }
    },
    reopenIntro: () => {
      setIntroOpen(true)
    },
  }
}
