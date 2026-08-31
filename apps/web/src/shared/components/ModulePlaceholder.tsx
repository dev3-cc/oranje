import type { ReactNode } from 'react'

import personajeAccidente from '@/assets/ilustrations/personaje-accidente-laboral.svg'
import mascotaPensando from '@/assets/mascota/mascota-pensando.png'

/** El personaje del módulo, si su ilustración ya existe en la marca. */
const MODULE_IMAGE: Record<string, string> = {
  Accidentes: personajeAccidente,
}

/**
 * Pantalla de un módulo que ya está en el sidebar pero todavía no tiene diseño.
 *
 * Existe para que el módulo NAVEGUE: un elemento del sidebar que no responde al
 * clic se lee como que la app está rota, no como que la pantalla está
 * pendiente. Aquí el usuario ve a dónde llegó, el sidebar marca el módulo
 * activo y la URL cambia.
 *
 * Se sustituye por la feature real en cuanto llegue la maqueta; entonces esta
 * ruta apunta a `@/features/<modulo>` y este componente desaparece cuando ya no
 * lo use nadie.
 */
export function ModulePlaceholder({ title }: { title: string }): ReactNode {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>

      <div className="rounded-lg border border-dashed border-line bg-surface p-12 text-center">
        <img
          src={MODULE_IMAGE[title] ?? mascotaPensando}
          alt=""
          aria-hidden
          className="mx-auto mb-4 h-36 w-auto"
        />
        <p className="text-base font-semibold text-ink">Pantalla pendiente de diseño</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-3">
          El módulo «{title}» ya está en el menú, pero todavía no tiene diseño ni datos que mostrar.
          Se construye aquí en cuanto llegue la maqueta.
        </p>
      </div>
    </div>
  )
}
