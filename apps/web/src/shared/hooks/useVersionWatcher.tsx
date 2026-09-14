import { toast } from '@oranje/ui'
import confetti from 'canvas-confetti'
import { useEffect, type ReactNode } from 'react'

import personajeTratoCerrado from '@/assets/ilustrations/personaje-trato-cerrado.svg'
import { Button } from '@/shared/components/Button'

/**
 * Avisa cuando hay una VERSIÓN NUEVA del sistema desplegada.
 *
 * No necesita endpoint: Firebase Hosting sirve `index.html` SIN caché
 * (firebase.json) y cada build lo cambia (los assets van con hash). Se toma
 * una huella al arrancar y se re-consulta cada tanto y al volver a la
 * pestaña; si cambió, un toast persistente con confetti ofrece recargar —
 * personaje-trato-cerrado porque es el mismo tono de "algo bueno acaba de
 * pasar" que ya usa Conversión, no un aviso neutro más. Cada ambiente vigila
 * su propio hosting: staging avisa de staging, producción de la suya.
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

function celebrate(): void {
  /* `prefers-reduced-motion` ya se respeta en el resto de la app (D-31/motion.ts). */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  void confetti({
    particleCount: 120,
    spread: 90,
    startVelocity: 45,
    origin: { x: 0.85, y: 0.85 },
    colors: ['#FFA64D', '#FF9933', '#1FA84A', '#FFD500'],
  })
}

function NewVersionToast({ onReload }: { onReload: () => void }): ReactNode {
  return (
    <div className="flex w-full max-w-sm gap-3 rounded-xl border border-line bg-surface p-4 shadow-lg">
      <img
        src={personajeTratoCerrado}
        alt=""
        aria-hidden
        className="h-16 w-auto shrink-0 self-center"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm font-bold text-ink">Hay una versión nueva del sistema</p>
        <p className="text-xs leading-relaxed text-ink-3">
          Recarga para tener los últimos cambios.
        </p>
        <div className="mt-2">
          <Button variant="primary" onClick={onReload}>
            Recargar
          </Button>
        </div>
      </div>
    </div>
  )
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
        celebrate()
        toast.custom(() => <NewVersionToast onReload={() => window.location.reload()} />, {
          id: TOAST_ID,
          duration: Infinity,
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
