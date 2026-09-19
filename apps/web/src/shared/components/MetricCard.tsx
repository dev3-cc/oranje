import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  cn,
  MaterialIcon,
} from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

/** El tono del ícono: la métrica que exige acción se distingue de las demás. */
export type MetricTone = 'brand' | 'danger'

const TONE_CLASS: Record<MetricTone, string> = {
  brand: 'bg-o-50 text-o-700',
  danger: 'bg-red/10 text-red',
}

/**
 * Métrica de encabezado, sobre la `Card` compuesta de shadcn con la receta
 * del bloque `dashboard-01` (SectionCards): qué mide arriba en voz baja, la
 * cifra grande en números tabulares, el ícono como `CardAction` y el pie en
 * el `CardFooter`. El velo naranja de abajo hacia arriba es el del bloque,
 * con el primario de Oranje.
 *
 * El pie no es decorativo: sin él, un «21%» o un «5» no dicen de qué. Es la
 * diferencia entre un tablero que informa y uno que solo enseña números.
 *
 * El cero se pinta en gris: un «0» del mismo peso que un «12» grita igual, y
 * en un tablero de hoy el cero suele ser la respuesta tranquila («nadie en
 * accidente»), no la alarma. El tono `danger` solo pinta el ícono: el color
 * nunca habla solo, la etiqueta ya dice qué pasa.
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
  const isZero = /^0([^\d]|$)/.test(value.trim())

  const content = (
    <Card
      className={cn(
        '@container/card h-full gap-3 bg-gradient-to-t from-o-500/5 to-card py-5 shadow-xs',
        to !== undefined && 'transition-colors hover:border-o-500 hover:from-o-500/10',
      )}
    >
      <CardHeader className="px-5">
        <CardDescription className="text-ink-2">{label}</CardDescription>
        <CardTitle
          className={cn(
            'text-3xl font-semibold tracking-tight tabular-nums @[220px]/card:text-4xl',
            isZero ? 'text-ink-3' : 'text-ink',
          )}
        >
          {value}
        </CardTitle>
        {icon && (
          <CardAction>
            <span
              className={cn('flex size-9 items-center justify-center rounded-md', TONE_CLASS[tone])}
            >
              <MaterialIcon name={icon} className="text-xl" aria-hidden />
            </span>
          </CardAction>
        )}
      </CardHeader>
      <CardFooter className="px-5 text-xs text-ink-3">{foot}</CardFooter>
    </Card>
  )

  if (to === undefined) return content

  return (
    <Link
      to={to}
      className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
    >
      {content}
    </Link>
  )
}
