import { useState } from 'react'

/**
 * Un onboarding se ve UNA vez: el visto queda en `localStorage` por pantalla
 * (conveniencia por navegador, no estado de negocio) y `reopen` lo vuelve a
 * mostrar a demanda («¿Cómo funciona?»).
 *
 * Sin storage disponible (el jsdom de vitest no lo trae; navegadores con
 * datos bloqueados tampoco) el intro SE MUESTRA y el visto no persiste:
 * fail-open — es descartable, y esconderlo rompería los specs que lo
 * atraviesan.
 */
export function useIntroSeen(screenKey: string): {
  isIntroOpen: boolean
  dismissIntro: () => void
  reopenIntro: () => void
} {
  const storageKey = `oranje-intro-${screenKey}`

  const [isIntroOpen, setIntroOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(storageKey) !== 'true'
    } catch {
      return true
    }
  })

  return {
    isIntroOpen,
    dismissIntro: () => {
      setIntroOpen(false)
      try {
        window.localStorage.setItem(storageKey, 'true')
      } catch {
        /* Sin storage el visto no persiste; la sesión actual sí lo respeta. */
      }
    },
    reopenIntro: () => {
      setIntroOpen(true)
    },
  }
}
