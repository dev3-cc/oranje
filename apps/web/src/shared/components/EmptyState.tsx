import type { ReactNode } from 'react'

import personajeSinResultados from '@/assets/ilustrations/personaje-sin-resultados.svg'

/**
 * El vacío con cara: un personaje y la explicación de POR QUÉ no hay nada,
 * nunca una caja con una línea seca. `image` permite otro personaje cuando el
 * contexto tiene el suyo (la mascota en Mi Personal, por ejemplo).
 */
export function EmptyState({
  title,
  text,
  image = personajeSinResultados,
  action,
}: {
  title: string
  /** La explicación honesta: qué tendría que pasar para que esto se llene. */
  text: string
  image?: string
  action?: ReactNode
}): ReactNode {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-surface px-8 py-12 text-center">
      <img src={image} alt="" aria-hidden className="h-36 w-auto" />
      <p className="text-base font-bold text-ink">{title}</p>
      <p className="max-w-md text-sm leading-relaxed text-ink-3">{text}</p>
      {action !== undefined && <div className="mt-1">{action}</div>}
    </div>
  )
}
