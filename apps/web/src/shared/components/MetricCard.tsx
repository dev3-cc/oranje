import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

/** El tono del ícono: la métrica que exige acción se distingue de las demás. */
export type MetricTone = 'brand' | 'danger'

const TONE_CLASS: Record<MetricTone, string> = {
  brand: 'bg-o-50 text-o-700',
  danger: 'bg-red/10 text-red',
}

/**
 * Métrica de encabezado: cifra grande, qué mide y de dónde sale.
 *
 * El pie no es decorativo: sin él, un «21%» o un «5» no dicen de qué. Es la
 * diferencia entre un tablero que informa y uno que solo enseña números.
 *
 * ⚠ No se usa `KpiCard` de `packages/ui`: aquella pone la etiqueta ENCIMA del
 * valor y exige ícono y tendencia. Cuando se pueda tocar ese paquete, lo
 * razonable es unificarlas ahí y borrar esta.
 */
export function MetricCard({
  value,
  label,
  foot,
  icon,
  tone = 'brand',
  to,
}: {
  value: string
  label: string
  foot: string
  /** Nombre de Material Icons. Sin él la tarjeta va sin chip, como el Dashboard. */
  icon?: string
  tone?: MetricTone
  /**
   * A dónde lleva la métrica, si lleva a algún lado. Con esto la tarjeta pasa a
   * ser un `<a>` completo —no un `<div>` con `onClick`— y conserva el foco por
   * teclado, el clic central y abrir en pestaña nueva.
   */
  to?: string
}): ReactNode {
  const content = (
    <div
      className={cn(
        'h-full rounded-lg border border-line bg-surface p-5',
        to !== undefined && 'transition-colors hover:border-o-500 hover:bg-o-50',
      )}
    >
      {icon && (
        <span
          className={cn(
            'mb-4 flex size-10 items-center justify-center rounded-md',
            TONE_CLASS[tone],
          )}
        >
          <span className="material-icons-outlined text-xl leading-none" aria-hidden>
            {icon}
          </span>
        </span>
      )}

      <p className="text-4xl tracking-tight text-ink">{value}</p>
      <p className="mt-3 text-sm text-ink">{label}</p>
      <p className="mt-1 text-xs text-ink-3">{foot}</p>
    </div>
  )

  if (to === undefined) return content

  return (
    <Link
      to={to}
      className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
    >
      {content}
    </Link>
  )
}
