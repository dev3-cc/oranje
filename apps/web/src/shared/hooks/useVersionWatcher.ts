import { toast } from '@oranje/ui'
import { useEffect } from 'react'

/**
 * Avisa cuando hay una VERSIÓN NUEVA del sistema desplegada.
 *
 * No necesita endpoint: Firebase Hosting sirve `index.html` SIN caché
 * (firebase.json) y cada build lo cambia (los assets van con hash). Se toma
 * una huella al arrancar y se re-consulta cada tanto y al volver a la
 * pestaña; si cambió, un toast persistente ofrece recargar. Cada ambiente
 * vigila su propio hosting: staging avisa de staging, producción de la suya.
 */
const POLL_MS = 5 * 60 * 1000
const TOAST_ID = 'new-version'

async function fingerprint(): Promise<string | null> {
  try {
    const res = await fetch('/index.html', { cache: 'no-store' })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export function useVersionWatcher(): void {
  useEffect(() => {
    /* En dev el index.html lo sirve Vite y muta con HMR: no hay qué vigilar. */
    if (import.meta.env.DEV) return

    let baseline: string | null = null
    let isDisposed = false

    void fingerprint().then((value) => {
      baseline = value
    })

    async function check(): Promise<void> {
      if (isDisposed || baseline === null) return
      const current = await fingerprint()
      if (current !== null && current !== baseline) {
        toast.info('Hay una versión nueva del sistema', {
          id: TOAST_ID,
          duration: Infinity,
          description: 'Recarga para tener los últimos cambios.',
          action: {
            label: 'Recargar',
            onClick: () => {
              window.location.reload()
            },
          },
        })
      }
    }

    const interval = setInterval(() => {
      void check()
    }, POLL_MS)

    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      isDisposed = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
}
