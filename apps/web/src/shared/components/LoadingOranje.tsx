import { lazy, Suspense, type ReactNode } from 'react'

import logoOranje from '@/assets/logo/Logo_ORANJE_Orange.png'

/**
 * Pantalla de carga de marca: la naranja 3D girando. La escena entra por
 * `lazy` y con el wordmark en pulso como respaldo — si el chunk de three.js
 * todavía no llega (que es justo cuando más se carga), el loader no se queda
 * en blanco ni arrastra three al bundle inicial.
 */
const LoadingOranjeScene = lazy(() => import('./three/LoadingOranjeScene'))

const LogoPulse = (): ReactNode => (
  <div className="flex h-full items-center justify-center">
    <img src={logoOranje} alt="" className="h-6 w-auto animate-pulse" />
  </div>
)

export function LoadingOranje({ label = 'Cargando…' }: { label?: string }): ReactNode {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex min-h-screen flex-col items-center justify-center gap-2 bg-surface-2"
    >
      <div className="h-44 w-44">
        <Suspense fallback={<LogoPulse />}>
          <LoadingOranjeScene />
        </Suspense>
      </div>
      <p className="text-sm text-ink-3">{label}</p>
    </div>
  )
}
