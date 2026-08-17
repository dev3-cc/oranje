import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

/**
 * Sin key, el mapa de Google pinta un recuadro gris con un error encima que se
 * lee como bug del front. Mejor decir qué falta y cómo se arregla.
 */
export function MissingMapsKeyNotice({ className }: { className?: string }): ReactNode {
  return (
    <div
      className={cn(
        'flex h-full flex-col items-center justify-center gap-3 p-10 text-center',
        className,
      )}
    >
      <p className="text-base font-semibold text-ink">Falta la API key de Google Maps</p>
      <p className="max-w-md text-sm leading-relaxed text-ink-3">
        Define <code className="text-ink-2">VITE_GOOGLE_MAPS_API_KEY</code> en tu{' '}
        <code className="text-ink-2">.env.local</code> para ver el mapa. El resto de la pantalla
        funciona igual sin ella. La key es pública por diseño (D-17): se restringe por referrer HTTP
        en la consola de GCP, no con Secret Manager.
      </p>
    </div>
  )
}
